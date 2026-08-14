/** Stored attachment shape in messages.metadata.attachments or preview rows. */
export type ChatAttachmentKind = "image" | "document"

export type ChatAttachmentRecord = {
  storage_path: string
  kind: ChatAttachmentKind
  mime_type: string
  filename: string
  size_bytes: number
  extracted_text?: string | null
  /** Populated at read time for UI / model (not persisted). */
  signed_url?: string | null
}

export type PreviewAttachmentRow = {
  id: string
  message_id: string | null
  session_id: string
  organization_id: string
  kind: ChatAttachmentKind
  storage_path: string
  mime_type: string
  filename: string
  size_bytes: number
  extracted_text: string | null
  created_at: string
}
