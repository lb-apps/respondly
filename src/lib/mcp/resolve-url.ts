/**
 * Resolve the address an MCP endpoint actually serves, by following the
 * redirects it answers with once — at configuration time, not per request.
 *
 * Why this has to happen up front: at request time the connection is pinned to
 * a single host (`allowedHosts` in `server-definition.ts`) so a redirect cannot
 * walk a credentialed request onto another origin. And even where a hop is
 * permitted, the MCP client drops the `Authorization` header across origins —
 * a redirected connection would arrive unauthenticated. So the common apex→www
 * rule (`example.com` → `www.example.com`) would break an address a person
 * typed perfectly reasonably, forever, with an error about a policy they have
 * never heard of. Storing the resolved address means no redirect is ever
 * followed while a secret is in flight.
 *
 * The probe is deliberately unauthenticated: it only needs `Location` headers,
 * and a secret must never be sent to a host we have not resolved yet. Every hop
 * is re-validated through `assertSafeMcpUrl`, so a redirect cannot point us at
 * a private address.
 *
 * `fetch` is injected so this is unit-testable without a network.
 */

import { assertSafeMcpUrl } from "./url"

const MAX_HOPS = 5
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])
const PROBE_TIMEOUT_MS = 5000

export type ResolvedMcpUrl = {
  /** The address to store and connect to. The input when nothing moved. */
  url: string
  /** True when a redirect chain was followed and the address changed. */
  redirected: boolean
}

export type ResolveMcpUrlOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/**
 * Only a move of scheme/host is adopted. A redirect that rewrites the path is
 * far more likely to be a login wall or a marketing page answering our GET than
 * a relocated endpoint, and silently storing it would break a config that
 * works. The operator sees the resulting 404 and fixes the path themselves.
 */
function sameEndpoint(a: URL, b: URL): boolean {
  return a.pathname === b.pathname && a.search === b.search
}

/** Best effort — an undrained body leaves the socket hanging. */
function discardBody(response: Response): void {
  try {
    void response.body?.cancel()
  } catch {
    // Already consumed or unsupported; nothing to release.
  }
}

export async function resolveMcpUrl(
  rawUrl: string,
  options: ResolveMcpUrlOptions = {}
): Promise<ResolvedMcpUrl> {
  const start = assertSafeMcpUrl(rawUrl)
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS

  let current = start
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "application/json, text/event-stream" },
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!REDIRECT_STATUS.has(response.status)) {
        discardBody(response)
        break
      }

      const location = response.headers.get("location")
      discardBody(response)
      if (!location) break

      // Relative `Location` values are legal, hence the base.
      const next = assertSafeMcpUrl(new URL(location, current).toString())
      if (!sameEndpoint(new URL(next), new URL(current))) break
      if (next === current) break
      current = next
    }
  } catch {
    // A probe is a convenience, never a gate: an unreachable server, a timeout
    // or a redirect into a private address all leave the address as typed. The
    // connection test is what reports the real failure to the operator.
    return { url: start, redirected: false }
  }

  return { url: current, redirected: current !== start }
}
