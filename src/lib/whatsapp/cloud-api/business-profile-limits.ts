/**
 * What Meta will accept in a WhatsApp business profile.
 *
 * Split from `business-profile.ts` for the same reason `media-limits.ts` is
 * split from `media.ts`: these are rules worth asserting in a unit test, and
 * they must not drag `server-only` into the test run. Pure values and functions.
 *
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/whatsapp-business-profile-api
 */

/**
 * Meta's business category. Shown on the profile so a customer can tell what
 * kind of business they are messaging. Order follows Meta's own listing.
 */
export const WHATSAPP_VERTICALS = [
  "OTHER",
  "AUTO",
  "BEAUTY",
  "APPAREL",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GROCERY",
  "GOVT",
  "HOTEL",
  "HEALTH",
  "NONPROFIT",
  "PROF_SERVICES",
  "RETAIL",
  "TRAVEL",
  "RESTAURANT",
  "ALCOHOL",
  "ONLINE_GAMBLING",
  "PHYSICAL_GAMBLING",
  "OTC_DRUGS",
] as const

export type WhatsAppVertical = (typeof WHATSAPP_VERTICALS)[number]

/** The one-line status under the business name. */
export const PROFILE_ABOUT_MAX = 139
/** The longer blurb on the profile sheet. */
export const PROFILE_DESCRIPTION_MAX = 512
export const PROFILE_ADDRESS_MAX = 256
export const PROFILE_EMAIL_MAX = 128
export const PROFILE_WEBSITE_MAX = 256
/** Meta stores at most two. A third is dropped, not rejected. */
export const PROFILE_WEBSITES_MAX = 2

/**
 * Profile photos render square. Meta accepts a smaller one and upscales it,
 * which looks worse than anything else on the profile — so we always encode at
 * this edge rather than passing the original through.
 */
export const PROFILE_PHOTO_EDGE = 640

/**
 * Formats the Resumable Upload API will mint a handle for. webp is absent on
 * purpose: like an image message, Meta accepts it and then never renders it.
 */
export const PROFILE_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png"])

/** Meta's ceiling for a profile photo upload. */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024

/**
 * Trim, drop blanks, and cap at two — the exact shape Meta's `websites` array
 * wants. The form carries two flat fields, so this is where they become a list.
 */
export function sanitizeWebsites(values: (string | undefined | null)[]): string[] {
  return values
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
    .slice(0, PROFILE_WEBSITES_MAX)
}
