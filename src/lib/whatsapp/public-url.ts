/**
 * Whether a media URL can be fetched by Meta's servers.
 *
 * Media we send by `link` is downloaded by WhatsApp, not by us. Meta accepts
 * the send synchronously and only reports the download failure later, in a
 * delivery receipt — so an address only *we* can reach produces a message that
 * looks sent, appears in the dashboard, and never arrives. Catch it up front.
 *
 * Pure function; returns a reason when the URL is unusable, or null when it is
 * fine to hand to Meta.
 */

const PRIVATE_IPV4 =
  /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
])

export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (LOCAL_HOSTNAMES.has(host)) return true
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true
  if (host.endsWith(".local") || host.endsWith(".test")) return true
  if (PRIVATE_IPV4.test(host)) return true
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  return /^f[cd][0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)
}

/** Reason Meta could not fetch this URL, or null when it looks fine. */
export function unreachableByMeta(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "not a valid URL"
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return `unsupported scheme ${parsed.protocol}`
  }
  if (isPrivateHostname(parsed.hostname)) {
    return `${parsed.hostname} is only reachable from this machine`
  }
  return null
}
