import "server-only"

import type { MetaCreds } from "./client"
import { graphGet, type GraphResult } from "./graph-request"

/**
 * Read-only health of the business phone number: the name Meta approved, the
 * quality rating that drives the sending limit, and where the number stands in
 * Meta's verification flow.
 *
 * None of this is settable from here on purpose. A display-name change goes
 * through Meta review (`name_status` tracks it) and is done in WhatsApp Manager;
 * offering a text field for it would promise something we cannot deliver.
 */

export const PHONE_NUMBER_FIELDS = [
  "verified_name",
  "display_phone_number",
  "quality_rating",
  "code_verification_status",
  "name_status",
  "platform_type",
  "throughput",
  "messaging_limit_tier",
  "is_official_business_account",
  "status",
].join(",")

export interface WhatsAppPhoneNumberInfo {
  verified_name?: string
  display_phone_number?: string
  /** GREEN / YELLOW / RED — drives how many people you may message per day. */
  quality_rating?: string
  code_verification_status?: string
  name_status?: string
  platform_type?: string
  throughput?: { level?: string }
  messaging_limit_tier?: string
  is_official_business_account?: boolean
  status?: string
}

export async function fetchPhoneNumberInfo(
  creds: MetaCreds
): Promise<GraphResult<WhatsAppPhoneNumberInfo>> {
  return graphGet<WhatsAppPhoneNumberInfo>(
    creds.phoneNumberId,
    { fields: PHONE_NUMBER_FIELDS },
    creds.accessToken
  )
}
