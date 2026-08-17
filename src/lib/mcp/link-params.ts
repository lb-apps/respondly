/**
 * Query params that ride along on links the assistant sends to the
 * organisation's own site.
 *
 * Nothing here knows what the params mean. A hotel tags a campaign, a shop tags
 * a referral, a clinic tags the channel a patient came from — to this module
 * they are names and values, and the org decides which of them travel.
 *
 * The values are not stored twice. They already live on the connected system's
 * own query params (`mcp_servers.query_params`), which is the thing that will
 * actually honour them; a server's `link_params` only names which of those keys
 * also belong on an outbound link. Keeping one copy is what stops the value the
 * assistant advertises from drifting away from the value the system applies.
 */

export interface LinkParam {
  name: string
  value: string
}

/** One connected system's contribution: its params, and which of them travel. */
export interface LinkParamSource {
  queryParams: Record<string, string> | null | undefined
  linkParams: string[] | null | undefined
}

/** `{{guestLocale}}` and friends — resolved per call, never a fixed tag. */
function isTemplate(value: string): boolean {
  return value.includes("{{")
}

/**
 * The params to hang on the org's own links, in the order their servers were
 * created.
 *
 * A name that resolves to nothing is dropped rather than sent empty: a marked
 * key whose value was cleared, or one whose value is a per-call template, would
 * otherwise put `?ref=` or `?ref={{guestLocale}}` on every link.
 *
 * First value wins for a repeated name, so two systems naming the same key
 * cannot make the prompt flip between turns — which matters, because this text
 * is part of a cached system prompt.
 */
export function linkParamsFrom(sources: LinkParamSource[]): LinkParam[] {
  const out: LinkParam[] = []
  const seen = new Set<string>()

  for (const source of sources) {
    const params = source.queryParams
    if (!params) continue

    for (const rawName of source.linkParams ?? []) {
      const name = rawName.trim()
      if (!name || seen.has(name)) continue

      const value = params[name]
      if (typeof value !== "string") continue
      const trimmed = value.trim()
      if (!trimmed || isTemplate(trimmed)) continue

      seen.add(name)
      out.push({ name, value: trimmed })
    }
  }

  return out
}
