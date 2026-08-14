import "server-only"

import { graphVersion } from "./client"
import type { GraphError } from "./graph-request"

/**
 * Meta's Resumable Upload API — the only way to get a `profile_picture_handle`.
 *
 * Note this endpoint family does NOT use the `Bearer` scheme the rest of Graph
 * uses; it wants `Authorization: OAuth <token>`. Sending Bearer here fails with
 * an unhelpful generic error, so it is spelled out in one place and never
 * routed through `./graph-request`.
 *
 * The messages-media endpoint in `./media.ts` is not a substitute: it returns a
 * media id, which the business-profile endpoint does not accept.
 *
 * https://developers.facebook.com/docs/graph-api/guides/upload
 */

export interface ResumableUploadInput {
  /** Meta app that owns the token — see `./meta-app`. */
  appId: string
  accessToken: string
  data: Uint8Array
  mimeType: string
  filename: string
}

export type ResumableUploadResult =
  | { ok: true; handle: string }
  | { ok: false; error: GraphError }

async function readError(res: Response): Promise<GraphError> {
  const text = await res.text().catch(() => "")
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string; code?: number; error_subcode?: number }
    }
    return {
      status: res.status,
      code: parsed.error?.code,
      subcode: parsed.error?.error_subcode,
      message: parsed.error?.message ?? text.slice(0, 300),
    }
  } catch {
    return { status: res.status, message: text.slice(0, 300) || res.statusText }
  }
}

/** Step 1: open a session. Returns the id, `upload:`-prefix intact. */
async function startSession(
  input: ResumableUploadInput
): Promise<{ ok: true; sessionId: string } | { ok: false; error: GraphError }> {
  const url = new URL(
    `https://graph.facebook.com/${graphVersion()}/${input.appId}/uploads`
  )
  url.searchParams.set("file_name", input.filename)
  url.searchParams.set("file_length", String(input.data.byteLength))
  url.searchParams.set("file_type", input.mimeType)

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `OAuth ${input.accessToken}` },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }

  const json = (await res.json()) as { id?: string }
  if (!json.id) {
    return {
      ok: false,
      error: { status: 502, message: "Meta returned no upload session id" },
    }
  }
  // Used verbatim in step 2 — the `upload:` prefix is part of the path.
  return { ok: true, sessionId: json.id }
}

/** Step 2: send the bytes in one shot and collect the handle. */
async function uploadBytes(
  sessionId: string,
  input: ResumableUploadInput
): Promise<ResumableUploadResult> {
  const res = await fetch(
    `https://graph.facebook.com/${graphVersion()}/${sessionId}`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${input.accessToken}`,
        file_offset: "0",
        "Content-Type": "application/octet-stream",
      },
      // Copy into a fresh ArrayBuffer: a Uint8Array view may be a window onto a
      // larger pooled buffer, and the body would take the whole thing.
      body: input.data.slice().buffer as ArrayBuffer,
    }
  )
  if (!res.ok) return { ok: false, error: await readError(res) }

  const json = (await res.json()) as { h?: string }
  return json.h
    ? { ok: true, handle: json.h }
    : { ok: false, error: { status: 502, message: "Meta returned no file handle" } }
}

export async function uploadResumable(
  input: ResumableUploadInput
): Promise<ResumableUploadResult> {
  try {
    const session = await startSession(input)
    if (!session.ok) return session
    return await uploadBytes(session.sessionId, input)
  } catch (err) {
    return {
      ok: false,
      error: {
        status: 0,
        message: err instanceof Error ? err.message : "network error",
      },
    }
  }
}
