import "server-only"

import { graphVersion } from "./client"

/**
 * Graph API transport for node and edge reads/writes — profile, phone number,
 * app metadata. Deliberately separate from `./client`, which owns the messages
 * endpoint and its `messaging_product` envelope; folding these in would put
 * every message send on the same code path as a settings form.
 *
 * Like `./client`, credentials are passed per call and never held at module
 * scope. Failures are values, not exceptions: callers turn them into Turkish
 * with `./graph-errors`.
 */

export interface GraphError {
  /** HTTP status, or 0 when the request never reached Meta. */
  status: number
  /** Meta's `error.code`, when it answered with its error envelope. */
  code?: number
  subcode?: number
  type?: string
  message: string
  fbtraceId?: string
}

export type GraphResult<T> = { ok: true; data: T } | { ok: false; error: GraphError }

interface MetaErrorEnvelope {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

function graphUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${path}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/**
 * Turn a failed response into a GraphError. Meta usually answers with its error
 * envelope; when it does not (a proxy, an HTML error page) we keep a clipped
 * slice of the body, the same defensive shape `client.ts` uses.
 */
async function toGraphError(res: Response): Promise<GraphError> {
  const text = await res.text().catch(() => "")
  let envelope: MetaErrorEnvelope | null = null
  try {
    envelope = JSON.parse(text) as MetaErrorEnvelope
  } catch {
    envelope = null
  }

  const metaError = envelope?.error
  return {
    status: res.status,
    code: metaError?.code,
    subcode: metaError?.error_subcode,
    type: metaError?.type,
    message: metaError?.message ?? text.slice(0, 300) ?? res.statusText,
    fbtraceId: metaError?.fbtrace_id,
  }
}

function toNetworkError(err: unknown): GraphError {
  return {
    status: 0,
    message: err instanceof Error ? err.message : "network error",
  }
}

/** GET a Graph node or edge with a Bearer token. */
export async function graphGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<GraphResult<T>> {
  try {
    const res = await fetch(graphUrl(path, params), {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Settings reads must reflect a change made seconds ago in WhatsApp
      // Manager, so never let Next cache them.
      cache: "no-store",
    })
    if (!res.ok) return { ok: false, error: await toGraphError(res) }
    return { ok: true, data: (await res.json()) as T }
  } catch (err) {
    return { ok: false, error: toNetworkError(err) }
  }
}

/** POST a JSON body to a Graph node or edge with a Bearer token. */
export async function graphPost<T>(
  path: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<GraphResult<T>> {
  try {
    const res = await fetch(graphUrl(path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, error: await toGraphError(res) }
    return { ok: true, data: (await res.json()) as T }
  } catch (err) {
    return { ok: false, error: toNetworkError(err) }
  }
}
