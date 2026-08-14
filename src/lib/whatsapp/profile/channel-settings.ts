import type { Json } from "@/types/database"
import {
  PROFILE_WEBSITES_MAX,
  WHATSAPP_VERTICALS,
  type WhatsAppVertical,
} from "@/lib/whatsapp/cloud-api/business-profile-limits"

/**
 * Our mirror of the WhatsApp business profile, stored in `channels.settings`.
 *
 * Meta is the source of truth. This cache exists so the settings page can
 * render a form without a Graph round-trip on every navigation, and so it still
 * renders something usable when the token is missing or Meta is degraded.
 *
 * Invariant enforced by the callers, not the types: this is only ever written
 * from a *successful* Meta GET, never from form input. Everything here is
 * therefore a value Meta has confirmed it stored.
 *
 * `channels.settings` is typed `Json`, so every read goes through
 * `readProfileCache` rather than a cast — the column may hold anything, including
 * values written by an older shape of this code.
 */
export interface WhatsAppProfileCache {
  about: string
  description: string
  address: string
  email: string
  vertical: WhatsAppVertical
  websites: string[]
  /**
   * Path in the `whatsapp-profile` bucket for the photo we pushed to Meta.
   * Meta's own `profile_picture_url` is a signed CDN url that expires, so it is
   * deliberately not stored here.
   */
  pictureStoragePath: string | null
  /** ISO timestamp of the last successful Meta read or write. */
  syncedAt: string | null
}

/** Key under `channels.settings` — namespaced so other features can coexist. */
const PROFILE_KEY = "whatsappProfile"

export const EMPTY_PROFILE_CACHE: WhatsAppProfileCache = {
  about: "",
  description: "",
  address: "",
  email: "",
  vertical: "OTHER",
  websites: [],
  pictureStoragePath: null,
  syncedAt: null,
}

function asRecord(value: Json | null | undefined): Record<string, Json> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, Json>
}

function asString(value: Json | undefined): string {
  return typeof value === "string" ? value : ""
}

function asVertical(value: Json | undefined): WhatsAppVertical {
  return typeof value === "string" &&
    (WHATSAPP_VERTICALS as readonly string[]).includes(value)
    ? (value as WhatsAppVertical)
    : EMPTY_PROFILE_CACHE.vertical
}

/** Read the mirror out of a `channels.settings` value. Never throws. */
export function readProfileCache(
  settings: Json | null | undefined
): WhatsAppProfileCache {
  const profile = asRecord(asRecord(settings)?.[PROFILE_KEY])
  if (!profile) return EMPTY_PROFILE_CACHE

  const websites = Array.isArray(profile.websites)
    ? profile.websites
        .filter((entry): entry is string => typeof entry === "string")
        .slice(0, PROFILE_WEBSITES_MAX)
    : []

  return {
    about: asString(profile.about),
    description: asString(profile.description),
    address: asString(profile.address),
    email: asString(profile.email),
    vertical: asVertical(profile.vertical),
    websites,
    pictureStoragePath:
      typeof profile.pictureStoragePath === "string"
        ? profile.pictureStoragePath
        : null,
    syncedAt: typeof profile.syncedAt === "string" ? profile.syncedAt : null,
  }
}

/**
 * Merge the mirror back into a `channels.settings` value.
 *
 * Read-modify-write rather than a replace: `settings` is a shared column, and a
 * later feature adding its own key must not be clobbered by a profile save.
 * Safe because a channel row has a single writer (the settings page); a
 * concurrent writer would need `jsonb_set` in SQL instead.
 */
export function writeProfileCache(
  settings: Json | null | undefined,
  next: WhatsAppProfileCache
): Json {
  const existing = asRecord(settings) ?? {}
  return { ...existing, [PROFILE_KEY]: { ...next } } as Json
}
