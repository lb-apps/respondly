import { createOpenRouter } from "@openrouter/ai-sdk-provider"

/**
 * Shared OpenRouter provider. Server-only — relies on OPENROUTER_API_KEY.
 * Never import this from client components.
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
})

/**
 * Default model for guest Q&A.
 *
 * Held to the same bar as the configured model rather than being a cheap
 * fallback: an org that never picks one still talks to customers, and a
 * different voice — or a model that invents an address — is not an acceptable
 * default. Compared head to head on a real conversation, Sonnet 5 was the only
 * candidate that answered from the sources instead of filling gaps from memory.
 */
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5"

/**
 * OpenRouter retired some Anthropic slugs (e.g. claude-3.7-sonnet → 404), and
 * older Sonnets fabricated specifics — street names, phone numbers — that
 * appear in no source. Saved configs are migrated to the current model rather
 * than left pointing at either problem.
 */
const MODEL_ALIASES: Record<string, string> = {
  "anthropic/claude-3.7-sonnet": "anthropic/claude-sonnet-5",
  "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-5",
  "anthropic/claude-sonnet-4": "anthropic/claude-sonnet-5",
  "anthropic/claude-sonnet-4.5": "anthropic/claude-sonnet-5",
}

export function resolveOpenRouterModel(model: string): string {
  const trimmed = model.trim()
  return MODEL_ALIASES[trimmed] ?? trimmed
}
