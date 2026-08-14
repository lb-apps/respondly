import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Verify Meta's `X-Hub-Signature-256` header: HMAC-SHA256 over the **raw**
 * request body, keyed by the app secret, hex, prefixed with `sha256=`.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validating-payloads
 */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null,
  appSecret: string
): boolean {
  if (!header || !appSecret) return false
  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf-8").digest("hex")

  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Handle Meta's webhook verification GET handshake. Returns the challenge to
 * echo (200) when the mode + verify token match, else null (caller → 403).
 */
export function webhookVerifyChallenge(
  searchParams: URLSearchParams,
  verifyToken: string
): string | null {
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")
  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return challenge ?? ""
  }
  return null
}
