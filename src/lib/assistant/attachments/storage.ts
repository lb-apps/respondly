import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import {
  CHAT_ATTACHMENTS_BUCKET,
  attachmentPath,
  classifyAttachmentKind,
  extFromMime,
} from "./constants"
import { extractAttachmentText } from "./extract"
import type { ChatAttachmentRecord } from "./types"

type DB = SupabaseClient<Database>

export async function uploadChatAttachment(
  supabase: DB,
  args: {
    orgId: string
    threadId: string
    data: Uint8Array
    mimeType: string
    filename: string
  }
): Promise<ChatAttachmentRecord | null> {
  const ext = extFromMime(args.mimeType)
  const kind = classifyAttachmentKind(args.mimeType, ext)
  if (!kind) return null

  const path = attachmentPath(args.orgId, args.threadId, ext)
  const { error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .upload(path, args.data, { contentType: args.mimeType, upsert: false })

  if (error) return null

  let extracted_text: string | null = null
  if (kind === "document") {
    try {
      extracted_text = await extractAttachmentText(args.data, ext)
    } catch {
      extracted_text = null
    }
  }

  return {
    storage_path: path,
    kind,
    mime_type: args.mimeType,
    filename: args.filename,
    size_bytes: args.data.byteLength,
    extracted_text,
  }
}
