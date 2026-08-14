import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { MetaCreds } from "@/lib/whatsapp/cloud-api/client"
import { uploadWhatsAppMedia } from "@/lib/whatsapp/cloud-api/media"
import { normalizeForWhatsApp } from "@/lib/whatsapp/cloud-api/image-normalize"
import {
  WHATSAPP_IMAGE_DOWNLOAD_MAX_BYTES,
  mediaCacheExpiry,
  normalizeMimeType,
  unsupportedAsImage,
} from "@/lib/whatsapp/cloud-api/media-limits"
import { isPrivateHostname } from "@/lib/whatsapp/public-url"

type DB = SupabaseClient<Database>

/**
 * Turn public image URLs into Meta media ids, remembering the result.
 *
 * Sending by `link` costs a full Meta-side download on every send — seconds per
 * picture, repeated for the same room photo in every conversation. We upload
 * each source URL once and send by id afterwards.
 *
 * The URLs come from MCP tool output and the knowledge base, i.e. untrusted
 * data, and this is the first place *we* fetch them rather than Meta. Every
 * hop is therefore checked against private address space before we connect,
 * and the response body is capped.
 */

/** Redirect hops we will follow; each one is re-validated. */
const MAX_REDIRECTS = 3

export interface ResolvedMedia {
  /** Media id to send with; absent when we could not upload this URL. */
  mediaId?: string
  /** Why this URL produced no media id. */
  error?: string
}

export function hashSourceUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex")
}

/** Reason we refuse to fetch this address, or null when it is safe to try. */
function unsafeToFetch(url: string): string | null {
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
    return `${parsed.hostname} is a private address`
  }
  return null
}

/** Read a body into memory, refusing anything past the download ceiling. */
async function readCapped(res: Response): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length") ?? "")
  if (Number.isFinite(declared) && declared > WHATSAPP_IMAGE_DOWNLOAD_MAX_BYTES) {
    return null
  }

  const reader = res.body?.getReader()
  if (!reader) return null

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    // One byte over the limit is enough to know; stop pulling.
    if (total > WHATSAPP_IMAGE_DOWNLOAD_MAX_BYTES) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

type FetchedImage = { data: Uint8Array; mimeType: string }

/**
 * Download an image, following redirects by hand so a public URL cannot bounce
 * us into the private network (cloud metadata endpoints being the classic).
 */
async function fetchPublicImage(
  url: string
): Promise<{ ok: true; file: FetchedImage } | { ok: false; error: string }> {
  let target = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const unsafe = unsafeToFetch(target)
    if (unsafe) return { ok: false, error: unsafe }

    let res: Response
    try {
      res = await fetch(target, { redirect: "manual" })
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "network error" }
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) return { ok: false, error: `redirect ${res.status} without location` }
      target = new URL(location, target).toString()
      continue
    }

    if (!res.ok) return { ok: false, error: `source responded ${res.status}` }

    const data = await readCapped(res)
    if (!data) return { ok: false, error: "source image is implausibly large" }

    return {
      ok: true,
      file: {
        data,
        mimeType: normalizeMimeType(res.headers.get("content-type") ?? ""),
      },
    }
  }

  return { ok: false, error: `more than ${MAX_REDIRECTS} redirects` }
}

/** Filename Meta shows nowhere but insists on; keep it stable and boring. */
function filenameFor(mimeType: string): string {
  return mimeType === "image/png" ? "image.png" : "image.jpg"
}

/** Upload one URL and record the id. Never throws; failure is a value. */
async function uploadAndRemember(
  supabase: DB,
  args: { orgId: string; creds: MetaCreds; url: string }
): Promise<ResolvedMedia> {
  const fetched = await fetchPublicImage(args.url)
  if (!fetched.ok) return { error: fetched.error }

  const normalized = await normalizeForWhatsApp(fetched.file)
  if (!normalized.ok) return { error: normalized.error }
  if (normalized.converted) {
    console.info(
      `[whatsapp] converted ${fetched.file.mimeType} → image/jpeg for ${args.url}`
    )
  }

  const image = normalized.image
  // Belt and braces: normalisation is supposed to guarantee this, and a picture
  // that slipped through would fail *after* Meta accepts the send.
  const unsupported = unsupportedAsImage({
    mimeType: image.mimeType,
    byteSize: image.data.byteLength,
  })
  if (unsupported) return { error: unsupported }

  const uploaded = await uploadWhatsAppMedia(args.creds, {
    data: image.data,
    mimeType: image.mimeType,
    filename: filenameFor(image.mimeType),
  })
  if (!uploaded.ok) return { error: uploaded.error }

  // Best effort: a cache write that fails costs one re-upload, not a message.
  const { error } = await supabase.from("whatsapp_media_cache").upsert(
    {
      organization_id: args.orgId,
      phone_number_id: args.creds.phoneNumberId,
      source_url: args.url,
      source_url_hash: hashSourceUrl(args.url),
      media_id: uploaded.id,
      mime_type: image.mimeType,
      byte_size: image.data.byteLength,
      expires_at: mediaCacheExpiry(new Date()).toISOString(),
    },
    { onConflict: "organization_id,phone_number_id,source_url_hash" }
  )
  if (error) {
    console.warn(`[whatsapp] media cache write failed for ${args.url}: ${error.message}`)
  }

  return { mediaId: uploaded.id }
}

/**
 * Resolve every URL to a media id, uploading the ones we have not seen.
 *
 * Uploads run concurrently — the caller still sends the messages in order, but
 * it should not pay for the downloads one after another.
 */
export async function resolveWhatsAppMediaIds(
  supabase: DB,
  args: { orgId: string; creds: MetaCreds; urls: string[] }
): Promise<Map<string, ResolvedMedia>> {
  const resolved = new Map<string, ResolvedMedia>()
  const unique = Array.from(new Set(args.urls))
  if (unique.length === 0) return resolved

  const hashes = new Map(unique.map((url) => [hashSourceUrl(url), url]))

  const { data: cached } = await supabase
    .from("whatsapp_media_cache")
    .select("source_url_hash, media_id")
    .eq("organization_id", args.orgId)
    .eq("phone_number_id", args.creds.phoneNumberId)
    .in("source_url_hash", Array.from(hashes.keys()))
    .gt("expires_at", new Date().toISOString())

  for (const row of cached ?? []) {
    const url = hashes.get(row.source_url_hash)
    if (url) resolved.set(url, { mediaId: row.media_id })
  }

  const misses = unique.filter((url) => !resolved.has(url))
  const uploads = await Promise.all(
    misses.map((url) =>
      uploadAndRemember(supabase, { orgId: args.orgId, creds: args.creds, url }).then(
        (result) => [url, result] as const
      )
    )
  )
  for (const [url, result] of uploads) resolved.set(url, result)

  return resolved
}

/**
 * Drop a cache entry whose media id Meta no longer honours, so the next send
 * re-uploads instead of failing again.
 */
export async function forgetWhatsAppMedia(
  supabase: DB,
  args: { orgId: string; phoneNumberId: string; url: string }
): Promise<void> {
  await supabase
    .from("whatsapp_media_cache")
    .delete()
    .eq("organization_id", args.orgId)
    .eq("phone_number_id", args.phoneNumberId)
    .eq("source_url_hash", hashSourceUrl(args.url))
}
