/** Client-safe helpers for knowledge file uploads. */

export const SUPPORTED_FILE_EXTS = ["pdf", "docx", "epub", "txt", "html", "md"] as const
export type SupportedFileExt = (typeof SUPPORTED_FILE_EXTS)[number]

export const KNOWLEDGE_FILE_ACCEPT = [".epub", ".pdf", ".docx", ".txt", ".html", ".md"] as const

export const KNOWLEDGE_IMAGE_ACCEPT = [".jpg", ".jpeg", ".png", ".webp"] as const

export const KNOWLEDGE_FILE_MAX_BYTES = 21 * 1024 * 1024

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  epub: "application/epub+zip",
  txt: "text/plain",
  html: "text/html",
  md: "text/plain",
}

export function fileExtOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? ""
}

export function mimeForFileExt(ext: string, fallback: string): string {
  return EXT_MIME[ext] ?? (fallback || "application/octet-stream")
}

/** Native file picker `accept` for a single extension (e.g. pdf → ".pdf"). */
export function acceptForFileExt(ext: string | null): string {
  const e = (ext ?? "").toLowerCase()
  return e ? `.${e}` : KNOWLEDGE_FILE_ACCEPT.join(",")
}
