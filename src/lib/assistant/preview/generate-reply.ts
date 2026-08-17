import type { SupabaseClient } from "@supabase/supabase-js"
import { RequestContext } from "@mastra/core/request-context"
import type { Database, Json } from "@/types/database"
import { buildSystemPrompt } from "@/mastra/prompt"
import { DEFAULT_MODEL } from "@/mastra/openrouter"
import type { AssistantRequestContext } from "@/mastra/agents/whatsapp-assistant"
import {
  getToolInput,
  getToolOutput,
  normalizeToolCalls,
  normalizeToolResults,
  type ToolCallLike,
  type ToolResultLike,
} from "@/mastra/tool-results"
import { buildPreviewModelMessages } from "@/lib/assistant/preview/store"
import { detectGuestLocaleFromMessages } from "@/lib/assistant/conversation-language"
import { resolveContactLocale } from "@/lib/assistant/contact-locale"
import { buildContactContextBlock } from "@/lib/assistant/contact-context"
import { parsePersonaSnapshot } from "@/lib/contacts/profile-store"
import { buildGuestLanguagePromptBlock } from "@/lib/assistant/guest-language-prompt"
import { runAssistantTurn } from "@/lib/assistant/run-turn"
import { getLinkParams, getMcpToolCatalogue } from "@/lib/supabase/queries/mcp-servers"

type DB = SupabaseClient<Database>

/** Build UI message parts from a non-streaming agent turn (WhatsApp parity). */
export function buildAssistantMessageParts(
  text: string,
  toolResults: ToolResultLike[],
  toolCalls: ToolCallLike[] = []
): unknown[] {
  const parts: unknown[] = []
  if (text.trim()) {
    parts.push({ type: "text", text: text.trim() })
  }
  for (const tr of toolResults) {
    const toolName = tr.toolName ?? tr.name
    if (!toolName) continue
    parts.push({
      type: "dynamic-tool",
      toolName,
      output: getToolOutput(tr),
      input: getToolInput(tr, toolCalls),
    })
  }
  return parts
}

export type PreviewAssistantMessage = {
  id: string
  role: "assistant"
  parts: unknown[]
}

/** A `system` row the turn wrote, so the live thread can show it at once. */
export type PreviewTurnEvent = {
  id: string
  createdAt: string
  metadata: unknown
}

export type PreviewTurn = {
  message: PreviewAssistantMessage | null
  /** Anything that happened to the contact card while the turn ran. */
  events: PreviewTurnEvent[]
}

/**
 * Run one assistant turn for preview — same engine as WhatsApp (`agent.generate`),
 * not streaming. Returns a complete message bubble payload for the UI.
 */
export async function generatePreviewAssistantReply(
  supabase: DB,
  args: { assistantId: string; sessionId: string }
): Promise<PreviewTurn> {
  const startedAt = new Date().toISOString()
  const { data: session } = await supabase
    .from("assistant_preview_sessions")
    .select("id, organization_id, assistant_id, persona_snapshot")
    .eq("id", args.sessionId)
    .maybeSingle()

  if (!session || session.assistant_id !== args.assistantId) {
    return NO_TURN
  }

  const { data: assistant, error } = await supabase
    .from("assistants")
    .select(
      "id, organization_id, model, system_prompt, tone, settings, organizations(name, timezone, industry, currency)"
    )
    .eq("id", args.assistantId)
    .single()

  if (error || !assistant || assistant.organization_id !== session.organization_id) {
    return NO_TURN
  }

  const org = assistant.organizations as
    | {
        name: string
        timezone: string | null
        industry: string | null
        currency: string | null
      }
    | null
  const orgName = org?.name ?? "İşletme"

  const settings =
    assistant.settings && typeof assistant.settings === "object" && !Array.isArray(assistant.settings)
      ? (assistant.settings as { firstMessage?: string; timezone?: string })
      : null

  const messages = await buildPreviewModelMessages(supabase, args.sessionId)
  if (messages.length === 0) return NO_TURN

  // The persona this run is playing, as the session holds it right now — the
  // assistant may have learned something about them a few turns ago.
  const persona = parsePersonaSnapshot(session.persona_snapshot)
  const contactBlock = buildContactContextBlock(persona)

  // Same rule as WhatsApp: what they are writing now wins, then whatever the
  // card says, then the country their number comes from. Anything less and the
  // preview would answer a German guest differently from production.
  const { locale: guestLocale, persist: languageLearned } = resolveContactLocale({
    detected: detectGuestLocaleFromMessages(
      messages.map((message) => ({
        role: message.role,
        content: message.parts as Array<{ type?: string; text?: string }>,
      }))
    ),
    preferred: persona?.preferredLanguage,
    phone: persona?.phone,
  })

  // Learned languages land on the session's copy, never on the persona card.
  if (languageLearned && persona) {
    const { error: localeError } = await supabase
      .from("assistant_preview_sessions")
      .update({
        persona_snapshot: {
          ...persona,
          preferredLanguage: guestLocale,
        } as unknown as Json,
      })
      .eq("id", args.sessionId)
    if (localeError) {
      console.warn(
        `[preview] could not save persona language: ${localeError.message}`
      )
    }
  }

  const [connectedServers, linkParams] = await Promise.all([
    getMcpToolCatalogue(supabase, assistant.organization_id),
    getLinkParams(supabase, assistant.organization_id),
  ])

  const systemPrompt = {
    stable: buildSystemPrompt({
      orgName,
      industry: org?.industry,
      persona: assistant.system_prompt,
      tone: assistant.tone,
      firstMessage: settings?.firstMessage ?? null,
      timezone: settings?.timezone ?? org?.timezone,
      connectedServers,
      linkParams,
    }),
    // Same order as the WhatsApp path: who they are, then what language to
    // answer in. The preview is only worth anything if it runs the real thing.
    perTurn: [contactBlock, buildGuestLanguagePromptBlock(guestLocale)].filter(
      (section): section is string => Boolean(section)
    ),
  }

  const requestContext = new RequestContext<AssistantRequestContext>()
  requestContext.set("systemPrompt", systemPrompt)
  requestContext.set("model", assistant.model || DEFAULT_MODEL)
  requestContext.set("orgId", assistant.organization_id)
  requestContext.set("assistantId", assistant.id)
  requestContext.set("conversationId", args.sessionId)
  // The persona lives on the session, so profile reads and writes go there —
  // the assistant can learn a name mid-run without touching the staff's card.
  requestContext.set(
    "contactRef",
    persona ? { kind: "preview_persona", sessionId: args.sessionId } : null
  )
  requestContext.set("guestLocale", guestLocale)

  let result
  try {
    ;({ result } = await runAssistantTurn({
      orgId: assistant.organization_id,
      // Preview sessions are not conversations, so claims stay unlinked.
      conversationId: null,
      messages,
      requestContext,
      runtime: {
        guestLocale,
        orgCurrency: org?.currency ?? "TRY",
        orgTimezone: settings?.timezone ?? org?.timezone ?? "Europe/Istanbul",
      },
    }))
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Asistan yanıt üretemedi"
    throw new Error(message, { cause: err })
  }

  const toolResults = normalizeToolResults(result.toolResults)
  const toolCalls = normalizeToolCalls(result.toolCalls)
  const text = (result.text ?? "").trim()
  const parts = buildAssistantMessageParts(text, toolResults, toolCalls)

  // Anything the turn recorded about the person, read back rather than threaded
  // out through the agent: the tools write these deep inside `agent.generate`,
  // and a collector passed down through Mastra to fetch them would be a lot of
  // plumbing for one query.
  const events = await turnEvents(supabase, args.sessionId, startedAt)

  return {
    message:
      parts.length > 0
        ? { id: crypto.randomUUID(), role: "assistant" as const, parts }
        : null,
    events,
  }
}

const NO_TURN: PreviewTurn = { message: null, events: [] }

/** The `system` rows written since the turn began, oldest first. */
async function turnEvents(
  supabase: DB,
  sessionId: string,
  since: string
): Promise<PreviewTurnEvent[]> {
  const { data } = await supabase
    .from("assistant_preview_messages")
    .select("id, created_at, metadata")
    .eq("session_id", sessionId)
    .eq("role", "system")
    .gte("created_at", since)
    .order("created_at", { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    metadata: row.metadata,
  }))
}
