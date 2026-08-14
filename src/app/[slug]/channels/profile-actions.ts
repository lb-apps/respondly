"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchBusinessProfile,
  updateBusinessProfile,
  type BusinessProfilePatch,
  type WhatsAppBusinessProfile,
} from "@/lib/whatsapp/cloud-api/business-profile"
import {
  fetchPhoneNumberInfo,
  type WhatsAppPhoneNumberInfo,
} from "@/lib/whatsapp/cloud-api/phone-number-info"
import { graphErrorToTurkish } from "@/lib/whatsapp/cloud-api/graph-errors"
import { resolveMetaAppId } from "@/lib/whatsapp/cloud-api/meta-app"
import { normalizeProfilePhoto } from "@/lib/whatsapp/cloud-api/profile-photo"
import { uploadResumable } from "@/lib/whatsapp/cloud-api/resumable-upload"
import { WHATSAPP_PROFILE_BUCKET } from "@/lib/whatsapp/profile/storage"
import {
  sanitizeWebsites,
  WHATSAPP_VERTICALS,
  type WhatsAppVertical,
} from "@/lib/whatsapp/cloud-api/business-profile-limits"
import {
  EMPTY_PROFILE_CACHE,
  readProfileCache,
  writeProfileCache,
  type WhatsAppProfileCache,
} from "@/lib/whatsapp/profile/channel-settings"
import { saveProfileSchema, type ProfileFormValues } from "./profile-schema"

/**
 * Server actions for the WhatsApp business profile.
 *
 * Kept out of `./actions.ts`, which owns the connection lifecycle. Both files
 * follow the same two-client discipline:
 *   - the RLS-scoped user client decides whether the caller may act at all,
 *   - the service-role client is used only to fetch the Vault token afterwards.
 * Reversing that order would bypass `channels.access`.
 */

export type ProfileActionResult = { ok: true } | { ok: false; error: string }

export interface ProfilePayload {
  values: ProfileFormValues
  /** Meta's own picture url — expiring, render-only, never persisted. */
  metaPictureUrl: string | null
  pictureStoragePath: string | null
  syncedAt: string | null
}

export type ProfileReadResult =
  | { ok: true; profile: ProfilePayload }
  | { ok: false; error: string }

export type HealthResult =
  | { ok: true; info: WhatsAppPhoneNumberInfo }
  | { ok: false; error: string }

const channelRefSchema = z.object({
  channelId: z.string().uuid(),
  slug: z.string().min(1),
})

interface ResolvedChannel {
  channelId: string
  phoneNumberId: string
  accessToken: string
  appId: string | null
  settings: import("@/types/database").Json
  organizationId: string
  cache: WhatsAppProfileCache
}

/**
 * RLS gate then Vault read. Returns a Turkish error rather than throwing, so
 * every caller can hand the string straight to a toast.
 */
async function resolveChannel(
  channelId: string
): Promise<{ ok: true; channel: ResolvedChannel } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  // RLS gate: the caller must be able to see the row before we touch anything
  // with the service-role client.
  const { data: row } = await supabase
    .from("channels")
    .select("id, organization_id, wa_phone_number_id, wa_app_id, settings")
    .eq("id", channelId)
    .maybeSingle()

  if (!row) return { ok: false, error: "Kanal bulunamadı" }
  if (!row.wa_phone_number_id) {
    return { ok: false, error: "Önce Phone Number ID'yi kaydet." }
  }

  const admin = createAdminClient()
  const { data: accessToken } = await admin.rpc("get_channel_wa_token", {
    p_channel_id: channelId,
  })
  if (!accessToken) {
    return {
      ok: false,
      error: "Kanalda kayıtlı erişim anahtarı yok. Önce WhatsApp bağlantısını tamamla.",
    }
  }

  return {
    ok: true,
    channel: {
      channelId,
      phoneNumberId: row.wa_phone_number_id,
      accessToken,
      appId: row.wa_app_id,
      settings: row.settings,
      organizationId: row.organization_id,
      cache: readProfileCache(row.settings),
    },
  }
}

function asVertical(value: string | undefined): WhatsAppVertical {
  return value && (WHATSAPP_VERTICALS as readonly string[]).includes(value)
    ? (value as WhatsAppVertical)
    : EMPTY_PROFILE_CACHE.vertical
}

/** Meta's answer → the shape our mirror and form both speak. */
function toCache(
  profile: WhatsAppBusinessProfile,
  pictureStoragePath: string | null
): WhatsAppProfileCache {
  return {
    about: profile.about ?? "",
    description: profile.description ?? "",
    address: profile.address ?? "",
    email: profile.email ?? "",
    vertical: asVertical(profile.vertical),
    websites: sanitizeWebsites(profile.websites ?? []),
    pictureStoragePath,
    syncedAt: new Date().toISOString(),
  }
}

function toFormValues(cache: WhatsAppProfileCache): ProfileFormValues {
  return {
    about: cache.about,
    description: cache.description,
    address: cache.address,
    email: cache.email,
    vertical: cache.vertical,
    website1: cache.websites[0] ?? "",
    website2: cache.websites[1] ?? "",
  }
}

/** Persist a freshly-read profile. User client on purpose: RLS is the gate. */
async function persistCache(
  channel: ResolvedChannel,
  cache: WhatsAppProfileCache
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("channels")
    .update({ settings: writeProfileCache(channel.settings, cache) })
    .eq("id", channel.channelId)
}

/**
 * Build the smallest patch that expresses what changed.
 *
 * An untouched field is omitted so a concurrent edit in WhatsApp Manager is not
 * silently reverted; a field the user emptied is sent as "" because that is how
 * Meta clears one.
 */
function buildPatch(
  next: ProfileFormValues,
  current: WhatsAppProfileCache
): BusinessProfilePatch {
  const patch: BusinessProfilePatch = {}

  if (next.about !== current.about) patch.about = next.about
  if (next.description !== current.description) patch.description = next.description
  if (next.address !== current.address) patch.address = next.address
  if (next.email !== current.email) patch.email = next.email
  if (next.vertical !== current.vertical) patch.vertical = next.vertical

  const websites = sanitizeWebsites([next.website1, next.website2])
  if (websites.join("\n") !== current.websites.join("\n")) {
    patch.websites = websites
  }

  return patch
}

/**
 * Write the profile to Meta, then read it back and mirror what Meta actually
 * stored — it normalises some values, and the form should show the truth rather
 * than what was typed.
 */
export async function saveWhatsAppProfile(
  input: z.input<typeof saveProfileSchema>
): Promise<ProfileActionResult> {
  const parsed = saveProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const { channelId, slug, ...values } = parsed.data

  const resolved = await resolveChannel(channelId)
  if (!resolved.ok) return resolved
  const { channel } = resolved

  const creds = {
    phoneNumberId: channel.phoneNumberId,
    accessToken: channel.accessToken,
  }

  const patch = buildPatch(values, channel.cache)
  if (Object.keys(patch).length > 0) {
    const written = await updateBusinessProfile(creds, patch)
    if (!written.ok) return { ok: false, error: graphErrorToTurkish(written.error) }
  }

  const fresh = await fetchBusinessProfile(creds)
  if (!fresh.ok) return { ok: false, error: graphErrorToTurkish(fresh.error) }

  await persistCache(channel, toCache(fresh.data, channel.cache.pictureStoragePath))
  revalidatePath(`/${slug}/channels`)
  return { ok: true }
}

/** Read the profile from Meta and refresh the mirror. */
export async function refreshWhatsAppProfile(
  input: z.input<typeof channelRefSchema>
): Promise<ProfileReadResult> {
  const parsed = channelRefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }

  const resolved = await resolveChannel(parsed.data.channelId)
  if (!resolved.ok) return resolved
  const { channel } = resolved

  const fresh = await fetchBusinessProfile({
    phoneNumberId: channel.phoneNumberId,
    accessToken: channel.accessToken,
  })
  if (!fresh.ok) return { ok: false, error: graphErrorToTurkish(fresh.error) }

  const cache = toCache(fresh.data, channel.cache.pictureStoragePath)
  await persistCache(channel, cache)

  return {
    ok: true,
    profile: {
      values: toFormValues(cache),
      metaPictureUrl: fresh.data.profile_picture_url ?? null,
      pictureStoragePath: cache.pictureStoragePath,
      syncedAt: cache.syncedAt,
    },
  }
}

const setPhotoSchema = z.object({
  channelId: z.string().uuid(),
  slug: z.string().min(1),
  /** Object path inside `whatsapp-profile`, uploaded by the client first. */
  storagePath: z.string().min(1).max(512),
})

/**
 * Push an already-uploaded photo to Meta.
 *
 * The client crops and uploads to Storage first, then hands us the path. Doing
 * it that way (rather than posting the file into this action) matches the
 * repo's existing upload idiom, keeps the bytes under the server-action body
 * limit, and leaves us with a stable public URL to render as "current photo" —
 * Meta's own `profile_picture_url` expires and cannot be persisted.
 */
export async function setWhatsAppProfilePhoto(
  input: z.input<typeof setPhotoSchema>
): Promise<ProfileActionResult> {
  const parsed = setPhotoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }
  const { channelId, slug, storagePath } = parsed.data

  const resolved = await resolveChannel(channelId)
  if (!resolved.ok) return resolved
  const { channel } = resolved

  // The path is org-scoped by the bucket's RLS policy; refuse anything that
  // does not sit under this channel's organization before we act on it.
  if (!storagePath.startsWith(`${channel.organizationId}/`)) {
    return { ok: false, error: "Geçersiz dosya yolu" }
  }

  const app = await resolveMetaAppId({
    storedAppId: channel.appId,
    accessToken: channel.accessToken,
  })
  if (!app) {
    return {
      ok: false,
      error:
        'Profil fotoğrafı için Meta Uygulama ID gerekli. Bağlantı sekmesindeki "İleri düzey" bölümünden gir.',
    }
  }

  const admin = createAdminClient()
  const { data: blob } = await admin.storage
    .from(WHATSAPP_PROFILE_BUCKET)
    .download(storagePath)
  if (!blob) return { ok: false, error: "Fotoğraf yüklenemedi." }

  const normalized = await normalizeProfilePhoto({
    data: new Uint8Array(await blob.arrayBuffer()),
  })
  if (!normalized.ok) return { ok: false, error: normalized.error }

  const uploaded = await uploadResumable({
    appId: app.appId,
    accessToken: channel.accessToken,
    data: normalized.image.data,
    mimeType: normalized.image.mimeType,
    filename: "profile.jpg",
  })
  if (!uploaded.ok) return { ok: false, error: graphErrorToTurkish(uploaded.error) }

  const creds = {
    phoneNumberId: channel.phoneNumberId,
    accessToken: channel.accessToken,
  }
  const written = await updateBusinessProfile(creds, {
    profile_picture_handle: uploaded.handle,
  })
  if (!written.ok) return { ok: false, error: graphErrorToTurkish(written.error) }

  const supabase = await createClient()

  // Pay the discovery round-trip once.
  if (app.discovered) {
    await supabase
      .from("channels")
      .update({ wa_app_id: app.appId })
      .eq("id", channelId)
  }

  const previousPath = channel.cache.pictureStoragePath
  await persistCache(channel, { ...channel.cache, pictureStoragePath: storagePath })

  // Only after the row points at the new object — a failure here leaves an
  // orphan, which is cheaper than a row pointing at a deleted file.
  if (previousPath && previousPath !== storagePath) {
    await supabase.storage.from(WHATSAPP_PROFILE_BUCKET).remove([previousPath])
  }

  revalidatePath(`/${slug}/channels`)
  return { ok: true }
}

/**
 * Read-only number health. Writes nothing and deliberately does not
 * `revalidatePath` — revalidating on a read would loop against the SWR hook
 * that calls this.
 */
export async function fetchWhatsAppHealth(input: {
  channelId: string
}): Promise<HealthResult> {
  const parsed = z.object({ channelId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }

  const resolved = await resolveChannel(parsed.data.channelId)
  if (!resolved.ok) return resolved

  const info = await fetchPhoneNumberInfo({
    phoneNumberId: resolved.channel.phoneNumberId,
    accessToken: resolved.channel.accessToken,
  })
  if (!info.ok) return { ok: false, error: graphErrorToTurkish(info.error) }

  return { ok: true, info: info.data }
}
