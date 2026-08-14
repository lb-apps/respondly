import { extractFileText, isSupportedFileExt } from "@/lib/knowledge/extract"

const MAX_EXTRACTED_CHARS = 12_000

/**
 * Extract readable text from a document attachment buffer.
 * Returns null for unsupported types (caller should handle images separately).
 */
export async function extractAttachmentText(
  buf: Uint8Array,
  ext: string
): Promise<string | null> {
  if (!isSupportedFileExt(ext)) return null
  const text = await extractFileText(buf, ext)
  const trimmed = text.trim()
  if (!trimmed) return null
  return trimmed.length > MAX_EXTRACTED_CHARS
    ? `${trimmed.slice(0, MAX_EXTRACTED_CHARS)}…`
    : trimmed
}
