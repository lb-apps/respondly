import "server-only"

import sharp from "sharp"
import {
  WHATSAPP_IMAGE_MAX_BYTES,
  WHATSAPP_IMAGE_MIME_TYPES,
  normalizeMimeType,
} from "./media-limits"

/**
 * Make downloaded bytes into something an `image` message will actually carry.
 *
 * Meta renders jpeg and png and nothing else, and it does not tell us so at
 * send time — it accepts the message, then fails the delivery. A knowledge base
 * full of webp therefore looks like it is answering guests and is not. Since
 * the upload path already holds the bytes, normalise here and cache the result,
 * so the conversion is paid once per source image rather than once per send.
 */

/** Longest edge we keep when an image has to be re-encoded to fit. */
const RESIZE_MAX_EDGE = 2048
const JPEG_QUALITY = 82
const JPEG_QUALITY_RETRY = 70

/**
 * Formats sharp will decode for us. SVG is deliberately absent: rasterising
 * attacker-supplied markup lets it reach for external references, and picture
 * URLs here come from MCP tool output.
 */
const CONVERTIBLE = new Set([
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
  "image/heic",
  "image/heif",
])

export interface NormalizedImage {
  data: Uint8Array
  mimeType: string
}

export type NormalizeResult =
  | { ok: true; image: NormalizedImage; converted: boolean }
  | { ok: false; error: string }

export interface EncodeJpegOptions {
  quality: number
  /**
   * Longest edge to fit inside, keeping the aspect ratio and never upscaling.
   * Ignored when `square` is set.
   */
  maxEdge?: number
  /**
   * Produce exactly this many pixels on each side, cropping to cover. For
   * fixed-format targets like a WhatsApp profile photo, where letterboxing or
   * an undersized image both look worse than a crop.
   */
  square?: number
}

/**
 * Re-encode anything sharp can decode as JPEG.
 *
 * Shared by the message-media path and the profile-photo path; the two want
 * different geometry but the same decode, flatten and encoder settings.
 */
export async function encodeJpeg(
  data: Uint8Array,
  { quality, maxEdge, square }: EncodeJpegOptions
): Promise<Uint8Array> {
  let pipeline = sharp(data, { animated: false })
  if (square) {
    pipeline = pipeline.resize({ width: square, height: square, fit: "cover" })
  } else if (maxEdge) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
  }
  // Flatten: a transparent webp or png turns black in JPEG otherwise.
  const buffer = await pipeline
    .flatten({ background: "#ffffff" })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
  return new Uint8Array(buffer)
}

function toJpeg(
  data: Uint8Array,
  quality: number,
  maxEdge?: number
): Promise<Uint8Array> {
  return encodeJpeg(data, { quality, maxEdge })
}

/**
 * Return bytes Meta accepts, converting or shrinking when needed.
 * Never throws: a picture we cannot handle is a value, not an exception.
 */
export async function normalizeForWhatsApp(file: {
  data: Uint8Array
  mimeType: string
}): Promise<NormalizeResult> {
  const mime = normalizeMimeType(file.mimeType)
  const supported = WHATSAPP_IMAGE_MIME_TYPES.has(mime)

  if (!supported && !CONVERTIBLE.has(mime)) {
    return { ok: false, error: `cannot convert image type ${mime || "unknown"}` }
  }

  if (supported && file.data.byteLength <= WHATSAPP_IMAGE_MAX_BYTES) {
    return { ok: true, image: { data: file.data, mimeType: mime }, converted: false }
  }

  try {
    // Oversized files get resized on the first attempt; a merely unsupported
    // format keeps its dimensions unless the re-encode comes out too big.
    const oversized = file.data.byteLength > WHATSAPP_IMAGE_MAX_BYTES
    let out = await toJpeg(
      file.data,
      JPEG_QUALITY,
      oversized ? RESIZE_MAX_EDGE : undefined
    )

    if (out.byteLength > WHATSAPP_IMAGE_MAX_BYTES) {
      out = await toJpeg(file.data, JPEG_QUALITY_RETRY, RESIZE_MAX_EDGE)
    }

    if (out.byteLength > WHATSAPP_IMAGE_MAX_BYTES) {
      return { ok: false, error: "image stays over Meta's 5MB limit after re-encoding" }
    }

    return { ok: true, image: { data: out, mimeType: "image/jpeg" }, converted: true }
  } catch (err) {
    return {
      ok: false,
      error: `could not decode image: ${err instanceof Error ? err.message : "unknown"}`,
    }
  }
}
