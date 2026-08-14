import "server-only"

import { graphVersion, type MetaCreds } from "./client"

/**
 * Download inbound WhatsApp media. Two-step (Cloud API):
 *   1. GET /{media-id} → JSON { url } (short-lived, Bearer-protected)
 *   2. GET that url with the same Bearer → the bytes
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${graphVersion()}/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!metaRes.ok) return null
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string }
    if (!meta.url) return null

    const binRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!binRes.ok) return null

    const mimeType =
      meta.mime_type ||
      binRes.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream"
    const data = new Uint8Array(await binRes.arrayBuffer())
    return { data, mimeType }
  } catch {
    return null
  }
}

export type UploadResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/**
 * Upload outbound media so later sends can reference it by id.
 *
 * Sending an image by `link` makes Meta fetch the URL before it answers us —
 * seconds per picture, paid again on every send. Uploading once turns each
 * subsequent send into a plain JSON POST. The id belongs to the phone number
 * that uploaded it and Meta keeps it for 30 days (see `./media-limits`).
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#upload-media
 */
export async function uploadWhatsAppMedia(
  creds: MetaCreds,
  file: { data: Uint8Array; mimeType: string; filename?: string }
): Promise<UploadResult> {
  const body = new FormData()
  body.append("messaging_product", "whatsapp")
  body.append("type", file.mimeType)
  body.append(
    "file",
    // Copy into a fresh ArrayBuffer: a Uint8Array view may be a window onto a
    // larger pooled buffer, and Blob would take the whole thing.
    new Blob([file.data.slice().buffer as ArrayBuffer], { type: file.mimeType }),
    file.filename || "upload"
  )

  try {
    const res = await fetch(
      `https://graph.facebook.com/${graphVersion()}/${creds.phoneNumberId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.accessToken}` },
        body,
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `Meta ${res.status}: ${text.slice(0, 300)}` }
    }

    const json = (await res.json()) as { id?: string }
    return json.id
      ? { ok: true, id: json.id }
      : { ok: false, error: "Meta returned no media id" }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" }
  }
}
