import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { attachmentsToModelParts } from "@/lib/assistant/attachments/parts"
import { signAttachmentUrl } from "@/lib/assistant/attachments/sign"
import type { ChatAttachmentRecord } from "@/lib/assistant/attachments/types"
import type { Json } from "@/types/database"
import { summarizeRichContent } from "@/lib/assistant/rich-summary"

type DB = SupabaseClient<Database>

export type ModelHistoryMessage = {
  role: "user" | "assistant"
  content: string | Array<{ type: string; text?: string; image?: string; data?: string; mimeType?: string }>
}

/**
 * Build multimodal model history from WhatsApp messages (guest + assistant).
 */
export async function buildWhatsAppModelHistory(
  supabase: DB,
  messages: Array<{
    role: string
    body: string
    metadata: Json | null
    /** What was actually delivered, when the row was a rich message. */
    rich_content?: Json | null
  }>
): Promise<ModelHistoryMessage[]> {
  const out: ModelHistoryMessage[] = []

  for (const m of messages) {
    const role = m.role === "guest" ? ("user" as const) : ("assistant" as const)
    const attachments = parseAttachmentsFromMetadata(m.metadata)

    if (role === "user" && attachments.length > 0) {
      const signed = await signAttachments(supabase, attachments)
      const attParts = await attachmentsToModelParts(signed, (path) =>
        signAttachmentUrl(supabase, path)
      )
      const text = m.body.trim()
      const content: ModelHistoryMessage["content"] = []
      if (text) content.push({ type: "text", text })
      content.push(...attParts)
      if (content.length > 0) {
        out.push({ role, content })
      }
      continue
    }

    const text = m.body.trim()

    // A rich message says what it was, not only what it read. Without this the
    // assistant's own carousel came back as a bare sentence and its photos came
    // back as nothing at all — so it could not tell what the customer had
    // already been shown, nor where those messages landed relative to its
    // words. See `@/lib/assistant/rich-summary`.
    const summary =
      role === "assistant" ? summarizeRichContent(m.rich_content) : null

    const content = [text, summary].filter(Boolean).join("\n")
    if (content) {
      out.push({ role, content })
    }
  }

  return out
}

function parseAttachmentsFromMetadata(metadata: Json | null): ChatAttachmentRecord[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return []
  const raw = (metadata as Record<string, unknown>).attachments
  if (!Array.isArray(raw)) return []
  const out: ChatAttachmentRecord[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const a = item as Record<string, unknown>
    if (typeof a.storage_path !== "string") continue
    if (a.kind !== "image" && a.kind !== "document") continue
    out.push({
      storage_path: a.storage_path,
      kind: a.kind,
      mime_type: typeof a.mime_type === "string" ? a.mime_type : "",
      filename: typeof a.filename === "string" ? a.filename : "dosya",
      size_bytes: typeof a.size_bytes === "number" ? a.size_bytes : 0,
      extracted_text: typeof a.extracted_text === "string" ? a.extracted_text : null,
    })
  }
  return out
}

async function signAttachments(
  supabase: DB,
  attachments: ChatAttachmentRecord[]
): Promise<ChatAttachmentRecord[]> {
  return Promise.all(
    attachments.map(async (a) => {
      if (a.kind !== "image") return a
      const signed_url = await signAttachmentUrl(supabase, a.storage_path)
      return { ...a, signed_url }
    })
  )
}
