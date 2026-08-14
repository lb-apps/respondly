import { SUPPORTED_FILE_EXTS } from "@/lib/knowledge/file-upload"

/** Private bucket for preview + WhatsApp chat attachments. */
export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments"

export const CHAT_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"] as const

export const CHAT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024

export const CHAT_ATTACHMENT_ACCEPT = [
  ...CHAT_IMAGE_EXTS.map((e) => `.${e}`),
  ...SUPPORTED_FILE_EXTS.map((e) => `.${e}`),
].join(",")

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

export function attachmentPath(orgId: string, threadId: string, ext: string): string {
  return `${orgId}/${threadId}/${crypto.randomUUID()}.${ext}`
}

export function classifyAttachmentKind(mime: string, ext: string): "image" | "document" | null {
  if (IMAGE_MIMES.has(mime) || CHAT_IMAGE_EXTS.includes(ext as (typeof CHAT_IMAGE_EXTS)[number])) {
    return "image"
  }
  if ((SUPPORTED_FILE_EXTS as readonly string[]).includes(ext.toLowerCase())) {
    return "document"
  }
  return null
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/epub+zip": "epub",
    "text/plain": "txt",
    "text/html": "html",
    "text/markdown": "md",
  }
  return map[mime] ?? "bin"
}
