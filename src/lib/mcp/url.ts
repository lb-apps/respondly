/**
 * Endpoint validation + URL assembly for MCP connections.
 *
 * The URL is authored by an org user and fetched by our server, so this module
 * is the SSRF gate: no internal hosts, no non-HTTP schemes, no credentials in
 * the URL. Pure functions — unit tested, no I/O.
 */

import { isPrivateHostname } from "@/lib/whatsapp/public-url"

export class McpUrlError extends Error {}

/** Dev needs localhost servers; production must never reach a private host. */
function allowsLocalHosts(): boolean {
  return process.env.NODE_ENV !== "production"
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * `www.example.com/api/mcp` is what a person copies out of a browser bar, and
 * rejecting it as "not a valid address" is our problem, not theirs. Assume
 * https when no scheme is given.
 *
 * A dev pointing at `localhost:3000` must still type `http://`: without the
 * `://` guard `new URL` reads `localhost:` as the scheme and silently accepts
 * an address that is not the one they meant.
 */
export function withDefaultScheme(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed || HAS_SCHEME.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/**
 * How an address reads to a person, the way a browser bar shows it: `https://`
 * is the expected case and carries no information, and `www.` is a routing
 * detail of the site rather than anything about the endpoint. `http://` stays
 * visible — there it is the whole point.
 *
 * Display only. The editable field keeps the stored address: that is the one
 * place where what we will actually connect to has to be visible.
 */
export function displayMcpUrl(rawUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return rawUrl
  }
  const scheme = parsed.protocol === "https:" ? "" : `${parsed.protocol}//`
  const host = parsed.host.replace(/^www\./i, "")
  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")
  return `${scheme}${host}${path}${parsed.search}`
}

/**
 * Validate a user-supplied MCP endpoint. Returns the normalized URL string.
 * Throws `McpUrlError` with a Turkish, operator-readable message.
 */
export function assertSafeMcpUrl(rawUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(withDefaultScheme(rawUrl))
  } catch {
    throw new McpUrlError("Geçerli bir adres girin (https://... ile başlamalı).")
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new McpUrlError("Yalnızca http ve https adresleri desteklenir.")
  }
  if (parsed.protocol === "http:" && !allowsLocalHosts()) {
    throw new McpUrlError("Adres https olmalı.")
  }
  if (parsed.username || parsed.password) {
    throw new McpUrlError(
      "Adreste kullanıcı adı/şifre olamaz. Kimlik doğrulamayı gizli anahtar alanına girin."
    )
  }
  if (isPrivateHostname(parsed.hostname) && !allowsLocalHosts()) {
    throw new McpUrlError("Yerel veya özel ağ adresleri bağlanamaz.")
  }

  return parsed.toString()
}

/** `{{guestLocale}}`-style substitution, whitelist only — unknown keys stay literal. */
export function renderTemplateValues(
  values: Record<string, string>,
  vars: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    out[key] = value.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
      name in vars ? vars[name] : match
    )
  }
  return out
}

/** Endpoint URL with the server's configured query params applied. */
export function buildMcpEndpointUrl(
  url: string,
  queryParams: Record<string, string>,
  vars: Record<string, string>
): URL {
  const parsed = new URL(url)
  for (const [key, value] of Object.entries(
    renderTemplateValues(queryParams, vars)
  )) {
    if (key.trim()) parsed.searchParams.set(key, value)
  }
  return parsed
}
