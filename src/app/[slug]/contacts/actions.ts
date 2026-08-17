"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { applyContactPatch, contactPatchSchema } from "@/lib/contacts/update"
import {
  CONTACTS_PAGE_SIZE,
  getContactCard,
  listContacts,
  type ContactCard,
  type ContactPage,
} from "@/lib/supabase/queries/contacts"
import { getPhoneCountry, isValidPhone, normalizePhoneE164 } from "@/lib/phone"

/**
 * What the Kişiler page can ask the server to do.
 *
 * Every action runs on the caller's own Supabase client, so RLS (`inbox.access`,
 * `contacts_write_inbox`) is the access check — an id from another org yields
 * nothing to read and refuses every write, whatever the client sends.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

const listSchema = z.object({
  organizationId: z.string().uuid(),
  search: z.string().max(200).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
})

export type LoadContactsResult =
  | { ok: true; page: ContactPage }
  | { ok: false; error: string }

/** One page of cards — what search and "daha fazla" both come back through. */
export async function loadContacts(
  input: z.input<typeof listSchema>
): Promise<LoadContactsResult> {
  const parsed = listSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const page = await listContacts(parsed.data.organizationId, {
    search: parsed.data.search,
    offset: parsed.data.offset ?? 0,
    limit: CONTACTS_PAGE_SIZE,
  })
  return { ok: true, page }
}

const saveSchema = z.object({
  contactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  slug: z.string().min(1),
  patch: contactPatchSchema,
})

export type SaveContactResult =
  | { ok: true; contact: ContactCard }
  | { ok: false; error: string }

/**
 * Save an edited card. The write itself — and the rule that the thread line
 * comes from diffing the row rather than from the submitted patch — is shared
 * with the inbox panel in `applyContactPatch`. With no conversation named, the
 * change is announced in the contact's newest thread.
 */
export async function saveContact(
  input: z.input<typeof saveSchema>
): Promise<SaveContactResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const { contactId, organizationId, slug, patch } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const result = await applyContactPatch(supabase, {
    contactId,
    patch,
    actorUserId: user.id,
  })
  if (!result.ok) return result

  const contact = await getContactCard(organizationId, contactId)
  if (!contact) return { ok: false, error: "Kişi bulunamadı" }

  revalidatePath(`/${slug}/contacts`)
  revalidatePath(`/${slug}/inbox`)
  return { ok: true, contact }
}

const createSchema = z.object({
  organizationId: z.string().uuid(),
  slug: z.string().min(1),
  phone: z.string().trim().min(1, "Telefon numarası gerekli"),
  patch: contactPatchSchema,
})

export type CreateContactResult =
  | { ok: true; contact: ContactCard; duplicate: boolean }
  | { ok: false; error: string }

/** Postgres unique violation — here, `contacts_org_phone_idx`. */
const UNIQUE_VIOLATION = "23505"

/**
 * Add someone by hand, before they have ever written to us.
 *
 * The number is the identity: it is stored as E.164 like every other contact,
 * because that is what an inbound WhatsApp message will be matched against —
 * a locally-typed "0532…" would sit next to the real card forever without
 * ever joining it.
 *
 * A number the org already has is not an error. The card that exists is
 * returned instead, and the caller opens it — the person the teammate was
 * looking for is on screen either way.
 */
export async function createContact(
  input: z.input<typeof createSchema>
): Promise<CreateContactResult> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const { organizationId, slug, phone, patch } = parsed.data

  if (!isValidPhone(phone)) {
    return { ok: false, error: "Geçerli bir telefon numarası girin" }
  }
  const e164 = normalizePhoneE164(phone)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: organizationId,
      phone: e164,
      first_name: patch.firstName ?? null,
      last_name: patch.lastName ?? null,
      email: patch.email ?? null,
      nationality: patch.nationality?.toUpperCase() ?? null,
      // Seeded from the dialling code when nobody stated one, the same way an
      // inbound contact gets its country.
      country: patch.country?.toUpperCase() ?? getPhoneCountry(e164) ?? null,
      preferred_language: patch.preferredLanguage ?? null,
      tags: patch.tags ?? [],
      notes: patch.notes ?? null,
    })
    .select("id")
    .maybeSingle()

  if (error?.code === UNIQUE_VIOLATION) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", e164)
      .maybeSingle()

    if (!existing) return { ok: false, error: "Bu numara zaten kayıtlı" }

    const contact = await getContactCard(organizationId, existing.id)
    if (!contact) return { ok: false, error: "Bu numara zaten kayıtlı" }
    return { ok: true, contact, duplicate: true }
  }

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Kişi oluşturulamadı" }

  const contact = await getContactCard(organizationId, data.id)
  if (!contact) return { ok: false, error: "Kişi oluşturulamadı" }

  revalidatePath(`/${slug}/contacts`)
  return { ok: true, contact, duplicate: false }
}
