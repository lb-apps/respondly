import { Agent } from "@mastra/core/agent"
import { openrouter, DEFAULT_MODEL, resolveOpenRouterModel } from "@/mastra/openrouter"
import {
  buildSystemPrompt,
  type AssistantPromptSections,
} from "@/mastra/prompt"
import { searchKnowledgeTool } from "@/mastra/tools/search-knowledge"
import { askChoiceTool } from "@/mastra/tools/ask-choice"
import { showCarouselTool } from "@/mastra/tools/show-carousel"
import { requestLocationTool } from "@/mastra/tools/request-location"
import { sendLocationTool } from "@/mastra/tools/send-location"
import { sendLinkButtonTool } from "@/mastra/tools/send-link-button"
import { flagSourceConflictTool } from "@/mastra/tools/flag-source-conflict"
import { getContactProfileTool } from "@/mastra/tools/get-contact-profile"
import { updateContactProfileTool } from "@/mastra/tools/update-contact-profile"

/**
 * Built-in tools every org gets. Live business data (availability, prices,
 * orders) does NOT live here — it arrives per turn as MCP toolsets resolved
 * from the org's connected servers.
 */
const tools = {
  search_knowledge: searchKnowledgeTool,
  ask_choice: askChoiceTool,
  show_carousel: showCarouselTool,
  request_location: requestLocationTool,
  send_location: sendLocationTool,
  send_link_button: sendLinkButtonTool,
  flag_source_conflict: flagSourceConflictTool,
  get_contact_profile: getContactProfileTool,
  update_contact_profile: updateContactProfileTool,
}

/**
 * Per-request context injected by the route handler. A single registered agent
 * serves every org/assistant; behavior is resolved dynamically from this
 * context so we never register one static agent per tenant.
 */
export interface AssistantRequestContext extends Record<string, unknown> {
  /**
   * Ordered system messages, split at the cache boundary. Order carries
   * meaning — the last section a model reads weighs most, so identity and
   * voice sit near the end on purpose.
   */
  systemPrompt: AssistantPromptSections
  model: string
  orgId: string
  assistantId: string | null
  /** Set in the WhatsApp loop so tools can log claims; null in the sandbox. */
  conversationId: string | null
  /** The person behind the conversation, for contact-profile read/write. Null in the sandbox. */
  contactId: string | null
  /** Detected conversation locale (tr|en|de|ru) for tools and templated MCP params. */
  guestLocale: string
}

const FALLBACK_SECTIONS: AssistantPromptSections = {
  stable: buildSystemPrompt({ orgName: "İşletme" }),
  perTurn: [],
}

/**
 * Turn the ordered sections into system messages, with one cache breakpoint at
 * the end of the stable half.
 *
 * A breakpoint caches everything *up to and including* the block it marks. Put
 * it on the final message and the per-turn context — this contact, this
 * language — lands inside the cached prefix, so the key changes every turn and
 * the cache never hits. Marking the last stable section instead means tools +
 * engine rules + identity are cached once and reused by every conversation in
 * the org, while the small per-turn tail is re-sent uncached.
 *
 * Model-agnostic by design:
 *  - Anthropic (and other explicit-cache models) honour the breakpoint.
 *  - Auto-cache models (Gemini, OpenAI, DeepSeek, Grok…) cache implicitly and
 *    ignore it. No harm, so we set it for all models.
 */
function cachedInstructions(sections: AssistantPromptSections) {
  const stable = sections.stable.map((s) => s.trim()).filter(Boolean)
  const perTurn = sections.perTurn.map((s) => s.trim()).filter(Boolean)
  const cacheable = stable.length > 0 ? stable : FALLBACK_SECTIONS.stable

  return [
    ...cacheable.map((content, index) => ({
      role: "system" as const,
      content,
      ...(index === cacheable.length - 1
        ? {
            providerOptions: {
              openrouter: { cacheControl: { type: "ephemeral" } },
            },
          }
        : {}),
    })),
    ...perTurn.map((content) => ({ role: "system" as const, content })),
  ]
}

/**
 * The WhatsApp guest assistant. Instructions + model are DynamicArguments
 * resolved from the request context (multi-tenant pattern).
 */
export const whatsappAssistant = new Agent<
  "whatsapp-assistant",
  typeof tools,
  undefined,
  AssistantRequestContext
>({
  id: "whatsapp-assistant",
  name: "WhatsApp Assistant",
  description:
    "İşletmenin WhatsApp gelen kutusunu yöneten müşteri asistanı (Q&A + bağlı sistemlerden canlı veri + insana devir).",
  instructions: ({ requestContext }) =>
    cachedInstructions(requestContext.get("systemPrompt") ?? FALLBACK_SECTIONS),
  model: ({ requestContext }) =>
    openrouter.chat(
      resolveOpenRouterModel(requestContext.get("model") || DEFAULT_MODEL)
    ),
  tools,
})
