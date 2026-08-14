"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isValidPhone, normalizePhoneE164 } from "@/lib/phone"

const saveSchema = z.object({
  organizationId: z.string().uuid(),
  channelId: z.string().uuid().nullable(),
  slug: z.string().min(1),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "WhatsApp numarası gerekli")
    .transform(normalizePhoneE164)
    .refine(isValidPhone, "Geçerli bir telefon numarası girin"),
  phoneNumberId: z
    .string()
    .trim()
    .regex(/^\d{6,}$/, "Geçerli bir Phone Number ID girin (sadece rakam)"),
  wabaId: z
    .string()
    .trim()
    .regex(/^\d{6,}$/, "Geçerli bir WABA ID girin")
    .optional()
    .or(z.literal("")),
  // Meta app that owns the token. Only the Resumable Upload API needs it, so it
  // stays optional and is discovered from the token when left blank.
  appId: z
    .string()
    .trim()
    .regex(/^\d{6,}$/, "Geçerli bir Uygulama ID girin (sadece rakam)")
    .optional()
    .or(z.literal("")),
  // Optional on update: leave blank to keep the stored token unchanged.
  accessToken: z.string().trim().min(10, "Access token çok kısa").optional().or(z.literal("")),
})

export type SaveChannelInput = z.input<typeof saveSchema>

export type ActionResult =
  | { ok: true; channelId: string }
  | { ok: false; error: string }

/**
 * Create or update the org's WhatsApp (Meta Cloud API) channel. The access
 * token is written to Supabase Vault via a SECURITY DEFINER RPC
 * (authorize_for_org gate) — never stored in the channels row. RLS enforces
 * channels.access on the row write.
 */
export async function saveChannel(
  input: SaveChannelInput
): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const v = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const tokenProvided = !!v.accessToken && v.accessToken.length > 0
  const wabaId = v.wabaId && v.wabaId.length > 0 ? v.wabaId : null
  const appId = v.appId && v.appId.length > 0 ? v.appId : null

  let channelId = v.channelId

  if (channelId) {
    const { error } = await supabase
      .from("channels")
      .update({
        phone_number: v.phoneNumber,
        wa_phone_number_id: v.phoneNumberId,
        waba_id: wabaId,
        wa_app_id: appId,
        error: null,
      })
      .eq("id", channelId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { data, error } = await supabase
      .from("channels")
      .insert({
        organization_id: v.organizationId,
        kind: "whatsapp",
        provider: "meta",
        phone_number: v.phoneNumber,
        wa_phone_number_id: v.phoneNumberId,
        waba_id: wabaId,
        wa_app_id: appId,
        status: "connecting",
      })
      .select("id")
      .single()
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Kanal oluşturulamadı" }
    }
    channelId = data.id
  }

  // Store/refresh the access token in Vault when provided.
  if (tokenProvided) {
    const { error: tokErr } = await supabase.rpc("set_channel_wa_token", {
      p_channel_id: channelId,
      p_token: v.accessToken as string,
    })
    if (tokErr) return { ok: false, error: tokErr.message }
  }

  // Mark connected once we have a phone number id and a stored token.
  const { data: row } = await supabase
    .from("channels")
    .select("wa_access_token_secret_id")
    .eq("id", channelId)
    .maybeSingle()
  const hasToken = !!row?.wa_access_token_secret_id

  await supabase
    .from("channels")
    .update({ status: hasToken ? "connected" : "connecting" })
    .eq("id", channelId)

  revalidatePath(`/${v.slug}/channels`)
  return { ok: true, channelId }
}

const disconnectSchema = z.object({
  channelId: z.string().uuid(),
  slug: z.string().min(1),
})

/** Pause the channel — keeps creds, stops the bot from being "connected". */
export async function disconnectChannel(
  input: z.input<typeof disconnectSchema>
): Promise<ActionResult> {
  const parsed = disconnectSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Geçersiz veri" }
  }
  const { channelId, slug } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const { error } = await supabase
    .from("channels")
    .update({ status: "disconnected" })
    .eq("id", channelId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/${slug}/channels`)
  return { ok: true, channelId }
}
