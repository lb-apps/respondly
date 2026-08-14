import { Mastra } from "@mastra/core/mastra"
import { whatsappAssistant } from "@/mastra/agents/whatsapp-assistant"

/**
 * Single Mastra instance for the app. Runs inside Next.js route handlers.
 * One registered agent serves every tenant; per-org behavior is injected via
 * the request context (see AssistantRequestContext).
 */
export const mastra = new Mastra({
  agents: { "whatsapp-assistant": whatsappAssistant },
})
