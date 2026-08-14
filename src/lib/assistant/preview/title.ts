import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateText } from "ai"
import type { Database } from "@/types/database"
import { openrouter, DEFAULT_MODEL } from "@/mastra/openrouter"

type DB = SupabaseClient<Database>

/** How many early messages feed the title model — enough to cover a debounced multi-message first turn. */
const TITLE_CONTEXT_LIMIT = 12

const TITLE_SYSTEM_PROMPT =
  "You name chat conversations. Read the exchange and return a SHORT title (3-6 words) that captures the main topic. " +
  "Match the language of the conversation. No quotes, no punctuation, no trailing period, no prefixes like 'Title:'."

/** Run the LLM to distill a conversation into a short title. Returns null on empty/failure. */
async function distillTitle(conversation: string): Promise<string | null> {
  if (!conversation.trim()) return null
  try {
    const { text } = await generateText({
      model: openrouter(DEFAULT_MODEL),
      system: TITLE_SYSTEM_PROMPT,
      prompt: `Conversation:\n${conversation}\n\nTitle:`,
      maxOutputTokens: 24,
    })
    const title = text
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/[.\s]+$/, "")
      .slice(0, 80)
    return title || null
  } catch {
    return null
  }
}

/**
 * Generate a title for a preview session — only if it has none yet (idempotent + lock-safe).
 *
 * Industry-standard chat-title behavior: distill the first complete exchange, write once, never
 * overwrite. The final UPDATE is guarded by `title IS NULL` so concurrent turns can't clobber it.
 *
 * @param opts.assistantText  Fresh assistant reply not yet persisted (route path). Appended to the
 *                            DB context so the title sees both sides even before the client saves it.
 */
export async function generateSessionTitleIfMissing(
  supabase: DB,
  sessionId: string,
  opts?: { assistantText?: string }
): Promise<string | null> {
  const { data: session } = await supabase
    .from("assistant_preview_sessions")
    .select("title, organization_id")
    .eq("id", sessionId)
    .maybeSingle()

  // Locked: title already set (or session gone) → never overwrite.
  if (!session || session.title) return null

  const { data: rows } = await supabase
    .from("assistant_preview_messages")
    .select("role, body")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(TITLE_CONTEXT_LIMIT)

  const lines = (rows ?? [])
    .map((m) => {
      const body = m.body.trim()
      if (!body) return null
      return `${m.role === "user" ? "User" : "Assistant"}: ${body.slice(0, 400)}`
    })
    .filter((l): l is string => l !== null)

  const assistantText = opts?.assistantText?.trim()
  const lastIsThisReply = assistantText && lines.at(-1) === `Assistant: ${assistantText.slice(0, 400)}`
  if (assistantText && !lastIsThisReply) {
    lines.push(`Assistant: ${assistantText.slice(0, 400)}`)
  }

  const title = await distillTitle(lines.join("\n"))
  if (!title) return null

  await supabase
    .from("assistant_preview_sessions")
    .update({ title })
    .eq("id", sessionId)
    .eq("organization_id", session.organization_id)
    .is("title", null)

  return title
}
