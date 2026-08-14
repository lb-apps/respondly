/** Client-safe storage constants for the WhatsApp profile photo. */

/**
 * Our copy of the photo we pushed to Meta.
 *
 * A separate bucket from `org-logos` on purpose: different lifecycle (a logo is
 * ours; this mirrors an artifact living in Meta) and a stricter mime allowlist —
 * webp is a delivery bug here, not a smaller file.
 */
export const WHATSAPP_PROFILE_BUCKET = "whatsapp-profile"

/** Public storage URL for a profile photo object path. */
export function whatsappProfilePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  return `${base}/storage/v1/object/public/${WHATSAPP_PROFILE_BUCKET}/${path}`
}
