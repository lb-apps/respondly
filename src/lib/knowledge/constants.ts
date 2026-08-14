/** Client-safe knowledge constants (no server-only imports). */
export const KNOWLEDGE_BUCKET = "knowledge"

/**
 * Public bucket for KB images. Docs stay private in KNOWLEDGE_BUCKET; images
 * live here so their public URL resolves for WhatsApp MediaUrl + <img> tags.
 */
export const KNOWLEDGE_IMAGE_BUCKET = "knowledge-images"

/** Turkish product label for the knowledge module (UI + permissions). */
export const KNOWLEDGE_LIBRARY_LABEL = "Bilgi Kütüphanesi"

/** One-line purpose copy under the library page title. */
export const KNOWLEDGE_LIBRARY_DESCRIPTION =
  "Asistanın müşteri konuşmalarında kullandığı bilgi kaynakları."

/** Max final bytes for a single media image upload. */
export const IMAGE_MAX_BYTES = 1 * 1024 * 1024

/** Image extensions accepted as knowledge sources. */
export const KNOWLEDGE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const

/** Public storage URL for a KB/media image object path. */
export function knowledgeImagePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  return `${base}/storage/v1/object/public/${KNOWLEDGE_IMAGE_BUCKET}/${path}`
}

/** Turkish product label for the media module (UI + nav). */
export const MEDIA_LIBRARY_LABEL = "Medya Galerisi"

/** One-line purpose copy under the media page title. */
export const MEDIA_LIBRARY_DESCRIPTION =
  "Asistanın konuşmalarda gösterdiği görseller."
