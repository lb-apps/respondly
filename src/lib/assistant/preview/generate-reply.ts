import type { SupabaseClient } from "@supabase/supabase-js"
import { RequestContext } from "@mastra/core/request-context"
import type { Database } from "@/types/database"
import { mastra } from "@/mastra"
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
import { resolveGuestLocaleFromMessages } from "@/lib/assistant/conversation-language"
import { buildGuestLanguagePromptBlock } from "@/lib/assistant/guest-language-prompt"
import { runAssistantTurn } from "@/lib/assistant/run-turn"
import { getMcpToolCatalogue } from "@/lib/supabase/queries/mcp-servers"

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

/**
 * Run one assistant turn for preview — same engine as WhatsApp (`agent.generate`),
 * not streaming. Returns a complete message bubble payload for the UI.
 */
export async function generatePreviewAssistantReply(
  supabase: DB,
  args: { assistantId: string; sessionId: string }
): Promise<PreviewAssistantMessage | null> {
  const { data: session } = await supabase
    .from("assistant_preview_sessions")
    .select("id, organization_id, assistant_id")
    .eq("id", args.sessionId)
    .maybeSingle()

  if (!session || session.assistant_id !== args.assistantId) {
    return null
  }

  const { data: assistant, error } = await supabase
    .from("assistants")
    .select(
      "id, organization_id, model, system_prompt, tone, settings, organizations(name, timezone, industry, currency)"
    )
    .eq("id", args.assistantId)
    .single()

  if (error || !assistant || assistant.organization_id !== session.organization_id) {
    return null
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
  if (messages.length === 0) return null

  const guestLocale = resolveGuestLocaleFromMessages(
    messages.map((message) => ({
      role: message.role,
      content: message.parts as Array<{ type?: string; text?: string }>,
    }))
  )

  const connectedServers = await getMcpToolCatalogue(
    supabase,
    assistant.organization_id
  )

  const systemPrompt = {
    stable: buildSystemPrompt({
      orgName,
      industry: org?.industry,
      persona: assistant.system_prompt,
      tone: assistant.tone,
      firstMessage: settings?.firstMessage ?? null,
      timezone: settings?.timezone ?? org?.timezone,
      connectedServers,
    }),
    perTurn: [buildGuestLanguagePromptBlock(guestLocale)],
  }

  const requestContext = new RequestContext<AssistantRequestContext>()
  requestContext.set("systemPrompt", systemPrompt)
  requestContext.set("model", assistant.model || DEFAULT_MODEL)
  requestContext.set("orgId", assistant.organization_id)
  requestContext.set("assistantId", assistant.id)
  requestContext.set("conversationId", args.sessionId)
  requestContext.set("contactId", null)
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

  if (parts.length === 0) return null

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts,
  }
}
