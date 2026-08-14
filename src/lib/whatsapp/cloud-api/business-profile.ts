import "server-only"

import type { MetaCreds } from "./client"
import { graphGet, graphPost, type GraphResult } from "./graph-request"

/**
 * The WhatsApp business profile — what a customer sees when they tap the
 * business name in a chat.
 *
 * Meta owns this record; we read it, write it, and mirror the result (see
 * `@/lib/whatsapp/profile/channel-settings`). Field limits live in
 * `./business-profile-limits` so they can be asserted without `server-only`.
 *
 * The token must carry `whatsapp_business_management`; `whatsapp_business_messaging`
 * alone reads and writes messages but not this profile.
 *
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/whatsapp-business-profile-api
 */

/** Meta requires an explicit field list on GET; omitting it returns almost nothing. */
export const BUSINESS_PROFILE_FIELDS =
  "about,address,description,email,profile_picture_url,websites,vertical"

export interface WhatsAppBusinessProfile {
  about?: string
  address?: string
  description?: string
  email?: string
  vertical?: string
  websites?: string[]
  /**
   * Read-only. A signed CDN url that expires within hours — render it from a
   * live response if you like, but never persist it.
   */
  profile_picture_url?: string
  messaging_product?: string
}

export interface BusinessProfilePatch {
  about?: string
  address?: string
  description?: string
  email?: string
  vertical?: string
  websites?: string[]
  /** Write-only, from the Resumable Upload API (`./resumable-upload`). */
  profile_picture_handle?: string
}

function profilePath(phoneNumberId: string): string {
  return `${phoneNumberId}/whatsapp_business_profile`
}

/**
 * Read the current profile.
 *
 * A number whose profile was never filled in answers `{ data: [] }`. That is an
 * empty profile, not a failure — returning an error here would make the
 * settings page unusable for exactly the orgs that most need it.
 */
export async function fetchBusinessProfile(
  creds: MetaCreds
): Promise<GraphResult<WhatsAppBusinessProfile>> {
  const res = await graphGet<{ data?: WhatsAppBusinessProfile[] }>(
    profilePath(creds.phoneNumberId),
    { fields: BUSINESS_PROFILE_FIELDS },
    creds.accessToken
  )
  if (!res.ok) return res
  return { ok: true, data: res.data.data?.[0] ?? {} }
}

/**
 * Write the given fields. Anything omitted from `patch` is left untouched;
 * an explicit empty string is how a field gets cleared.
 */
export async function updateBusinessProfile(
  creds: MetaCreds,
  patch: BusinessProfilePatch
): Promise<GraphResult<true>> {
  const res = await graphPost<{ success?: boolean }>(
    profilePath(creds.phoneNumberId),
    { messaging_product: "whatsapp", ...patch },
    creds.accessToken
  )
  if (!res.ok) return res

  if (res.data.success === false) {
    return {
      ok: false,
      error: { status: 400, message: "Meta rejected the profile update" },
    }
  }
  return { ok: true, data: true }
}
