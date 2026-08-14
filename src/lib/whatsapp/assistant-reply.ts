import type { SupabaseClient } from "@supabase/supabase-js"
import { RequestContext } from "@mastra/core/request-context"
import type { Database } from "@/types/database"
import { buildSystemPrompt } from "@/mastra/prompt"
import { DEFAULT_MODEL } from "@/mastra/openrouter"
import type { AssistantRequestContext } from "@/mastra/agents/whatsapp-assistant"
import {
  asRecord,
  getToolOutput,
  normalizeToolCalls,
  normalizeToolResults,
  type ToolResultLike,
} from "@/mastra/tool-results"
import { buildToolTrace, type ToolTracePart } from "@/lib/assistant/tool-trace"
import { getConversationHistory } from "@/lib/whatsapp/conversation"
import { formatAssistantText, formatAssistantMessageText, extractImageUrls } from "@/lib/assistant/format-text"
import { detectGuestLocaleFromMessages } from "@/lib/assistant/conversation-language"
import { resolveContactLocale } from "@/lib/assistant/contact-locale"
import { buildGuestLanguagePromptBlock } from "@/lib/assistant/guest-language-prompt"
import { buildContactContextBlock } from "@/lib/assistant/contact-context"
import { runAssistantTurn } from "@/lib/assistant/run-turn"
import {
  decideHandoff,
  survivedSystemFailure,
} from "@/lib/assistant/handoff-decision"
import { getMcpToolCatalogue } from "@/lib/supabase/queries/mcp-servers"
import { extractMcpImages } from "@/lib/mcp/images"
import { isMcpToolError } from "@/lib/mcp/toolsets"
import {
  toChoiceMessage,
  type ChoiceOptionView,
} from "@/lib/whatsapp/choice-message"
import {
  toCarouselMessage,
  type CarouselCardView,
} from "@/lib/whatsapp/carousel-message"

type DB = SupabaseClient<Database>

// ── Rich content types ──────────────────────────────────────────────────────

export type RichMessage =
  | {
      type: "image"
      imageUrl: string
      /**
       * Only ever set on messages stored before captions were dropped. Nothing
       * writes it now: every caption we produced was lifted from a document or
       * a gallery's alt text, none of it written for someone reading a chat.
       */
      caption?: string
    }
  | {
      type: "choice"
      body: string
      options: ChoiceOptionView[]
      listButtonLabel?: string
      footer?: string
      /** Labels alone do not carry the choice — force the list, not buttons. */
      descriptionsMatter?: boolean
    }
  | {
      type: "cta"
      body: string
      buttonLabel: string
      url: string
      /** Shown above the body, so they can see what they are paying for. */
      imageUrl?: string
    }
  | {
      type: "carousel"
      body: string
      cards: CarouselCardView[]
    }
  | { type: "location_request"; body: string }
  | {
      type: "location"
      latitude: number
      longitude: number
      name?: string
      address?: string
    }

export interface AssistantReply {
  /** The assistant's reply text to send to the guest. */
  text: string
  /** True when the assistant searched the KB but found nothing → hand off. */
  escalate: boolean
  /**
   * Which tools ran, in the shape the chat chips read. Persisted on the turn's
   * first message row so the inbox can show the same Kaynaklar / Araçlar /
   * Tutarsızlık chips the preview shows.
   */
  toolTrace: ToolTracePart[]
  /** Ordered queue of rich messages to send after the text reply. */
  richContent: RichMessage[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** True when a tool output carries a boolean success flag set to true. */
function flagIsTrue(out: unknown, key: "found" | "available"): boolean {
  return (
    typeof out === "object" &&
    out !== null &&
    key in out &&
    (out as Record<string, unknown>)[key] === true
  )
}

/** Max images attached to a single reply, regardless of how much a tool returned. */
const MAX_MCP_IMAGES = 4

/** Collect RichMessages from all tool results using the generic image protocol. */
function buildRichContent(
  toolResults: ToolResultLike[],
  mcpToolNames: Set<string>
): RichMessage[] {
  const rich: RichMessage[] = []
  const seenImageUrls = new Set<string>()

  for (const tr of toolResults) {
    const toolName = tr.toolName ?? tr.name

    if (toolName === "ask_choice") {
      const choice = toChoiceMessage(asRecord(getToolOutput(tr)))
      if (choice) rich.push(choice)
      continue
    }

    if (toolName === "show_carousel") {
      const carousel = toCarouselMessage(asRecord(getToolOutput(tr)))
      if (carousel) rich.push(carousel)
      continue
    }

    if (toolName === "send_location") {
      const out = asRecord(getToolOutput(tr))
      const latitude = typeof out?.latitude === "number" ? out.latitude : null
      const longitude = typeof out?.longitude === "number" ? out.longitude : null
      if (latitude !== null && longitude !== null) {
        rich.push({
          type: "location",
          latitude,
          longitude,
          ...(typeof out?.name === "string" ? { name: out.name } : {}),
          ...(typeof out?.address === "string" ? { address: out.address } : {}),
        })
      }
      continue
    }

    if (toolName === "request_location") {
      const out = asRecord(getToolOutput(tr))
      const body = typeof out?.body === "string" ? out.body.trim() : ""
      if (body) rich.push({ type: "location_request", body })
      continue
    }

    const out = asRecord(getToolOutput(tr))
    if (!out) continue

    if (toolName === "search_knowledge") {
      // Each passage with an imageUrl becomes an image RichMessage.
      const passages = Array.isArray(out.passages) ? out.passages : []
      for (const p of passages) {
        const rec = asRecord(p)
        if (!rec) continue
        const url = typeof rec.imageUrl === "string" ? rec.imageUrl : null
        if (!url || seenImageUrls.has(url)) continue
        seenImageUrls.add(url)
        rich.push({ type: "image", imageUrl: url })
      }
    } else if (toolName === "send_link_button") {
      // The model authors the copy in the guest's language; the tool echoes it
      // back so we can render from the result alone.
      const url = typeof out.url === "string" ? out.url : null
      const label = typeof out.label === "string" ? out.label.trim() : ""
      const body = typeof out.body === "string" ? out.body.trim() : ""
      const imageUrl = typeof out.imageUrl === "string" ? out.imageUrl : null
      if (url && label && body) {
        rich.push({
          type: "cta",
          body,
          buttonLabel: label,
          url,
          ...(imageUrl ? { imageUrl } : {}),
        })
      }
    } else if (toolName && mcpToolNames.has(toolName)) {
      // Any connected system may return pictures. We don't know its field
      // names, so scan the payload generically.
      if (isMcpToolError(out)) continue
      const remaining = MAX_MCP_IMAGES - seenImageUrls.size
      if (remaining <= 0) continue
      for (const image of extractMcpImages(out, remaining)) {
        if (seenImageUrls.has(image.url)) continue
        seenImageUrls.add(image.url)
        rich.push({ type: "image", imageUrl: image.url })
      }
    }
  }

  // A carousel already shows its pictures. The generic image scan runs over the
  // *same* availability result the model built the cards from, and it runs
  // first, so without this the customer gets four loose photos followed by a
  // carousel of the same four rooms.
  const onCards = new Set(
    rich.flatMap((message) =>
      message.type === "carousel"
        ? message.cards.map((card) => card.imageUrl)
        : []
    )
  )
  if (onCards.size === 0) return rich

  return rich.filter(
    (message) => message.type !== "image" || !onCards.has(message.imageUrl)
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Run the WhatsApp assistant for one conversation turn. Service-role client +
 * trusted org id (cookieless webhook). Resolves per-org assistant config,
 * builds the grounded system prompt, and returns the reply plus a handoff
 * signal derived from the knowledge-search results.
 *
 * Handoff rule (CLAUDE.md): if the assistant called search_knowledge and every
 * call came back empty, it has no grounding for a factual answer → escalate to
 * a human. Greetings/chitchat don't trigger a search, so they won't escalate.
 */
export async function generateAssistantReply(
  supabase: DB,
  args: { orgId: string; conversationId: string }
): Promise<AssistantReply> {
  const { data: assistant } = await supabase
    .from("assistants")
    .select(
      "id, model, system_prompt, tone, settings, organizations(name, timezone, industry, currency)"
    )
    .eq("organization_id", args.orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const org = assistant?.organizations as
    | {
        name: string
        timezone: string | null
        industry: string | null
        currency: string | null
      }
    | null
  const orgName = org?.name ?? "İşletme"

  const settings =
    assistant?.settings && typeof assistant.settings === "object" && !Array.isArray(assistant.settings)
      ? (assistant.settings as { firstMessage?: string; timezone?: string })
      : null

  const history = await getConversationHistory(supabase, args.conversationId)
  if (history.length === 0) {
    return { text: "", escalate: false, toolTrace: [], richContent: [] }
  }

  // The person behind the conversation — lets the contact-profile tools read
  // and enrich a single, shared profile during the turn.
  const { data: conversationRow } = await supabase
    .from("conversations")
    .select("contact_id, guest_phone")
    .eq("id", args.conversationId)
    .maybeSingle()

  // Everything already on the contact card goes into the prompt, so the
  // assistant never asks for something we can already see.
  const { data: contactRow } = conversationRow?.contact_id
    ? await supabase
        .from("contacts")
        .select(
          "first_name, last_name, phone, email, nationality, country, preferred_language"
        )
        .eq("id", conversationRow.contact_id)
        .maybeSingle()
    : { data: null }

  const contactBlock = buildContactContextBlock(
    contactRow
      ? {
          firstName: contactRow.first_name,
          lastName: contactRow.last_name,
          phone: contactRow.phone,
          email: contactRow.email,
          nationality: contactRow.nationality,
          country: contactRow.country,
          preferredLanguage: contactRow.preferred_language,
        }
      : { phone: conversationRow?.guest_phone ?? null }
  )

  // One language per person, and the contact card is where it lives. What they
  // are writing now wins; failing that, whatever the card learned last; failing
  // that, the country their number comes from.
  const { locale: guestLocale, persist: languageLearned } = resolveContactLocale(
    {
      detected: detectGuestLocaleFromMessages(history),
      preferred: contactRow?.preferred_language,
      phone: contactRow?.phone ?? conversationRow?.guest_phone,
    }
  )

  if (languageLearned && conversationRow?.contact_id) {
    // Awaited on purpose. A Supabase query builder is a lazy thenable, not a
    // promise: `void builder` never calls `.then()`, so the request is never
    // sent at all. That is how the line below this one — the only writer of
    // `conversations.language` — went unnoticed while every conversation in the
    // database sat at its default.
    const { error } = await supabase
      .from("contacts")
      .update({ preferred_language: guestLocale })
      .eq("id", conversationRow.contact_id)
    if (error) {
      console.warn(`[assistant] could not save contact language: ${error.message}`)
    }
  }

  // Cached catalogue, not a live handshake: keeps the prompt byte-stable
  // between turns so the provider prompt cache keeps hitting.
  const connectedServers = await getMcpToolCatalogue(supabase, args.orgId)

  // Split at the cache boundary: the stable half is identical for every
  // conversation in this org today, the per-turn half is not.
  const systemPrompt = {
    stable: buildSystemPrompt({
      orgName,
      industry: org?.industry,
      persona: assistant?.system_prompt,
      tone: assistant?.tone,
      // Staff-authored opening line. The sandbox has always passed this; the
      // production path did not, so the model improvised its own greeting.
      firstMessage: settings?.firstMessage ?? null,
      timezone: settings?.timezone ?? org?.timezone,
      connectedServers,
    }),
    perTurn: [contactBlock, buildGuestLanguagePromptBlock(guestLocale)].filter(
      (section): section is string => Boolean(section)
    ),
  }

  const requestContext = new RequestContext<AssistantRequestContext>()
  requestContext.set("systemPrompt", systemPrompt)
  requestContext.set("model", assistant?.model || DEFAULT_MODEL)
  requestContext.set("orgId", args.orgId)
  requestContext.set("assistantId", assistant?.id ?? null)
  requestContext.set("conversationId", args.conversationId)
  requestContext.set("contactId", conversationRow?.contact_id ?? null)
  requestContext.set("guestLocale", guestLocale)

  // Same reason as the contact write above: unawaited, this never ran, and the
  // handoff message — which reads this column — has been Turkish for everyone.
  const { error: languageError } = await supabase
    .from("conversations")
    .update({ language: guestLocale })
    .eq("id", args.conversationId)
  if (languageError) {
    console.warn(
      `[assistant] could not save conversation language: ${languageError.message}`
    )
  }

  const { result, mcpToolNames, mcpFailures } = await runAssistantTurn({
    orgId: args.orgId,
    conversationId: args.conversationId,
    messages: history,
    requestContext,
    runtime: {
      guestLocale,
      orgCurrency: org?.currency ?? "TRY",
      orgTimezone: settings?.timezone ?? org?.timezone ?? "Europe/Istanbul",
    },
  })

  const toolResultsList = normalizeToolResults(result.toolResults)
  // Needed for tools whose result does not echo its arguments back — the
  // conflict chip reads the input when the tool did not confirm the record.
  const toolCallsList = normalizeToolCalls(result.toolCalls)
  const toolTrace = buildToolTrace(toolResultsList, toolCallsList)

  // Grounding signals. The knowledge base and the connected systems answer
  // different halves of the same conversation — policies and house rules live
  // in one, anything live in the other — so they are tracked as two sources
  // that each either grounded this turn or did not.
  let knowledgeSearched = false
  let knowledgeFound = false
  let mcpToolCalled = false
  let mcpToolSucceeded = false
  let mcpToolFailed = false

  for (const tr of toolResultsList) {
    const toolName = tr.toolName ?? tr.name
    const out = getToolOutput(tr)
    if (toolName === "search_knowledge") {
      knowledgeSearched = true
      if (flagIsTrue(out, "found")) knowledgeFound = true
    } else if (toolName && mcpToolNames.has(toolName)) {
      mcpToolCalled = true
      // An empty result can be a correct answer ("no slots on Tuesday"); only a
      // real failure means that source could not do its job.
      if (isMcpToolError(asRecord(out))) mcpToolFailed = true
      else mcpToolSucceeded = true
    }
  }

  const rawText = (result.text ?? "").trim()
  const richContent = buildRichContent(toolResultsList, mcpToolNames).map((rich) => {
    if (
      rich.type === "choice" ||
      rich.type === "cta" ||
      rich.type === "location_request"
    ) {
      return { ...rich, body: formatAssistantText(rich.body) }
    }
    if (rich.type === "carousel") {
      // Card bodies render WhatsApp's emphasis marks, so they get the same
      // Markdown-to-WhatsApp pass as any other text the model wrote.
      return {
        ...rich,
        body: formatAssistantText(rich.body),
        cards: rich.cards.map((card) =>
          card.body ? { ...card, body: formatAssistantText(card.body) } : card
        ),
      }
    }
    return rich
  })

  // Safety net: if the model pasted a raw image URL into the reply text, send
  // it as a media message and strip the bare link from the text below.
  const existingImageUrls = new Set(
    richContent
      .filter((r): r is Extract<RichMessage, { type: "image" }> => r.type === "image")
      .map((r) => r.imageUrl)
  )
  for (const url of extractImageUrls(rawText)) {
    if (!existingImageUrls.has(url)) {
      existingImageUrls.add(url)
      richContent.push({ type: "image", imageUrl: url })
    }
  }

  const text = rawText
    ? formatAssistantMessageText(rawText, richContent)
    : ""
  // A server we could not reach is an operations problem, not a reason to
  // silence the assistant: handing off would mute every conversation for as
  // long as one integration is down, even for turns that never needed it.
  // It shows up on the MCP page instead.
  if (mcpFailures.length > 0) {
    console.warn(
      `[mcp] unreachable this turn: ${mcpFailures
        .map((failure) => `${failure.slug} (${failure.error})`)
        .join(", ")}`
    )
  }

  const signals = {
    knowledgeSearched,
    knowledgeFound,
    mcpToolCalled,
    mcpToolSucceeded,
    // A turn with no words and no rich message is silence to the customer.
    saidNothing: !text && richContent.length === 0,
  }
  const { handOff: escalate, reason } = decideHandoff(signals)

  if (escalate) {
    console.info(`[assistant] handing off ${args.conversationId}: ${reason}`)
  } else if (survivedSystemFailure({ ...signals, mcpToolFailed })) {
    // Worth knowing about even though the turn stood on its other source.
    console.warn(
      `[assistant] a connected system failed during ${args.conversationId}; the knowledge base carried the reply`
    )
  }

  return { text, escalate, toolTrace, richContent }
}
