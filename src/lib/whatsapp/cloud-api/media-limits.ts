/**
 * What Meta will accept as an outbound image, and how long it remembers it.
 *
 * Split from `media.ts` for the same reason `payloads.ts` is split from
 * `client.ts`: these are rules worth asserting in a unit test, and they must
 * not drag `server-only` into the test run. Pure functions.
 *
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
 */

/**
 * Image formats an `image` message accepts. Meta rejects everything else —
 * webp, gif and avif included — and it rejects them *after* accepting the send,
 * so an unsupported picture looks delivered and never arrives.
 */
export const WHATSAPP_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"])

/** Meta's size ceiling for an image message. */
export const WHATSAPP_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/**
 * How much we are willing to pull down before giving up. Larger than what Meta
 * accepts on purpose: an oversized original can be re-encoded into a sendable
 * one, and refusing it at download time would throw away that chance. It still
 * bounds what an untrusted URL can make us hold in memory.
 */
export const WHATSAPP_IMAGE_DOWNLOAD_MAX_BYTES = 16 * 1024 * 1024

/** How long Meta keeps an uploaded media id. */
export const WHATSAPP_MEDIA_TTL_DAYS = 30

/**
 * Expire our cache entries early. A row that outlives the id behind it turns
 * every send into a failure plus a retry, which is worse than re-uploading.
 */
const CACHE_TTL_DAYS = 25

/** Lower-case the type and drop `; charset=…`, so `IMAGE/JPEG;x` compares. */
export function normalizeMimeType(value: string): string {
  const mime = value.split(";")[0]?.trim().toLowerCase() ?? ""
  // Servers label JPEGs both ways; Meta only knows one of them.
  return mime === "image/jpg" ? "image/jpeg" : mime
}

/** Reason Meta would refuse this file as an image, or null when it is fine. */
export function unsupportedAsImage(file: {
  mimeType: string
  byteSize: number
}): string | null {
  const mime = normalizeMimeType(file.mimeType)
  if (!WHATSAPP_IMAGE_MIME_TYPES.has(mime)) {
    return `unsupported image type ${mime || "unknown"}`
  }
  if (file.byteSize <= 0) return "empty file"
  if (file.byteSize > WHATSAPP_IMAGE_MAX_BYTES) {
    return `image is ${Math.round(file.byteSize / 1024)}KB, over Meta's 5MB limit`
  }
  return null
}

/** When a cache row recorded at `uploadedAt` should stop being trusted. */
export function mediaCacheExpiry(uploadedAt: Date): Date {
  return new Date(uploadedAt.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)
}
