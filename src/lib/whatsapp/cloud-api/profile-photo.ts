import "server-only"

import { encodeJpeg, type NormalizedImage } from "./image-normalize"
import {
  PROFILE_PHOTO_EDGE,
  PROFILE_PHOTO_MAX_BYTES,
} from "./business-profile-limits"

/**
 * Make bytes into a WhatsApp profile photo.
 *
 * Kept apart from `normalizeForWhatsApp` because the rules differ: a profile
 * photo is always square, always re-encoded, and has no "pass it through if it
 * already fits" path. It is always JPEG regardless of what came in — the client
 * crop dialog is asked for JPEG too, but the client is a hint and the server is
 * the authority. A webp here would upload fine, mint a handle, and then never
 * render in WhatsApp.
 */

const JPEG_QUALITY = 90
const JPEG_QUALITY_RETRY = 75

export type ProfilePhotoResult =
  | { ok: true; image: NormalizedImage }
  | { ok: false; error: string }

export async function normalizeProfilePhoto(file: {
  data: Uint8Array
}): Promise<ProfilePhotoResult> {
  if (file.data.byteLength === 0) {
    return { ok: false, error: "Fotoğraf boş." }
  }

  try {
    let out = await encodeJpeg(file.data, {
      quality: JPEG_QUALITY,
      square: PROFILE_PHOTO_EDGE,
    })

    if (out.byteLength > PROFILE_PHOTO_MAX_BYTES) {
      out = await encodeJpeg(file.data, {
        quality: JPEG_QUALITY_RETRY,
        square: PROFILE_PHOTO_EDGE,
      })
    }

    if (out.byteLength > PROFILE_PHOTO_MAX_BYTES) {
      return { ok: false, error: "Fotoğraf çok büyük (en fazla 5 MB)." }
    }

    return { ok: true, image: { data: out, mimeType: "image/jpeg" } }
  } catch {
    // sharp throws on anything it cannot decode; that is a bad upload, not a bug.
    return { ok: false, error: "Fotoğraf okunamadı. JPG veya PNG yükle." }
  }
}
