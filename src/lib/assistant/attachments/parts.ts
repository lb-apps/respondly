import type { ChatAttachmentRecord } from "./types"

const MAX_DOC_CHARS_IN_PROMPT = 8_000

export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "file"; data: string; mimeType: string }

export type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; filename?: string; url: string }

/**
 * Build model-facing content parts from stored attachments.
 * Images use fresh signed URLs; documents use extracted text blocks.
 */
export async function attachmentsToModelParts(
  attachments: ChatAttachmentRecord[],
  sign: (path: string) => Promise<string | null>
): Promise<ModelContentPart[]> {
  const parts: ModelContentPart[] = []

  for (const att of attachments) {
    if (att.kind === "image") {
      const url = att.signed_url ?? (await sign(att.storage_path))
      if (url) {
        parts.push({ type: "image", image: url })
      }
    } else if (att.kind === "document" && att.extracted_text?.trim()) {
      const text = att.extracted_text.trim()
      const clipped =
        text.length > MAX_DOC_CHARS_IN_PROMPT
          ? `${text.slice(0, MAX_DOC_CHARS_IN_PROMPT)}…`
          : text
      parts.push({
        type: "text",
        text: `[Ek belge "${att.filename}"]:\n${clipped}`,
      })
    }
  }

  return parts
}

/** UI message parts for rendering user attachments in preview/inbox. */
export async function attachmentsToUIParts(
  attachments: ChatAttachmentRecord[],
  sign: (path: string) => Promise<string | null>
): Promise<UIMessagePart[]> {
  const parts: UIMessagePart[] = []

  for (const att of attachments) {
    if (att.kind === "image") {
      const url = att.signed_url ?? (await sign(att.storage_path))
      if (url) {
        parts.push({
          type: "file",
          mediaType: att.mime_type,
          filename: att.filename,
          url,
        })
      }
    } else {
      parts.push({
        type: "file",
        mediaType: att.mime_type,
        filename: att.filename,
        url: "",
      })
    }
  }

  return parts
}

export function parseMetadataAttachments(metadata: unknown): ChatAttachmentRecord[] {
  if (!metadata || typeof metadata !== "object") return []
  const rec = metadata as Record<string, unknown>
  const raw = rec.attachments
  if (!Array.isArray(raw)) return []
  const out: ChatAttachmentRecord[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const a = item as Record<string, unknown>
    const storage_path = typeof a.storage_path === "string" ? a.storage_path : null
    const kind = a.kind === "image" || a.kind === "document" ? a.kind : null
    const mime_type = typeof a.mime_type === "string" ? a.mime_type : ""
    const filename = typeof a.filename === "string" ? a.filename : "dosya"
    const size_bytes = typeof a.size_bytes === "number" ? a.size_bytes : 0
    const extracted_text =
      typeof a.extracted_text === "string" ? a.extracted_text : null
    if (storage_path && kind) {
      out.push({
        storage_path,
        kind,
        mime_type,
        filename,
        size_bytes,
        extracted_text,
      })
    }
  }
  return out
}

export function serializeAttachmentsForMetadata(
  attachments: ChatAttachmentRecord[]
): ChatAttachmentRecord[] {
  return attachments.map((a) => ({
    storage_path: a.storage_path,
    kind: a.kind,
    mime_type: a.mime_type,
    filename: a.filename,
    size_bytes: a.size_bytes,
    extracted_text: a.extracted_text ?? null,
  }))
}
