import "server-only"

import { graphGet } from "./graph-request"

/**
 * Which Meta app owns a channel's access token.
 *
 * Only the Resumable Upload API needs this (`POST /{app-id}/uploads`), and it
 * is genuinely per-org: Respondly asks each organization for a System User
 * token from *their* Meta app, so a single deployment-wide app id would be
 * wrong for exactly those orgs. Hence three tiers, most specific first.
 */

/** `GET /app` resolves to whichever app the presented token belongs to. */
export async function discoverMetaAppId(
  accessToken: string
): Promise<string | null> {
  const res = await graphGet<{ id?: string }>("app", { fields: "id" }, accessToken)
  return res.ok ? (res.data.id ?? null) : null
}

export interface ResolvedMetaApp {
  appId: string
  /** True when it came from discovery and is worth writing back to the row. */
  discovered: boolean
}

export async function resolveMetaAppId(input: {
  storedAppId: string | null
  accessToken: string
}): Promise<ResolvedMetaApp | null> {
  if (input.storedAppId) return { appId: input.storedAppId, discovered: false }

  const fromEnv = process.env.WHATSAPP_APP_ID?.trim()
  if (fromEnv) return { appId: fromEnv, discovered: false }

  const discovered = await discoverMetaAppId(input.accessToken)
  return discovered ? { appId: discovered, discovered: true } : null
}
