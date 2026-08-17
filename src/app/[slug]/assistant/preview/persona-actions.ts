"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { normalizePhoneE164 } from "@/lib/phone"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"
import {
  rowToPersona,
  type PreviewPersona,
} from "@/lib/supabase/queries/preview-personas"

/**
 * Creating and editing the preview's mock contact cards.
 *
 * Validation mirrors the real contact write (`inbox/actions.ts`) field for
 * field — a persona that could not exist as a contact would be a preview that
 * lies. Access is the org's own `assistant.access` RLS policy; nothing here
 * re-implements it.
 */

const personaFieldsSchema = z.object({
  label: z.string().trim().min(1, "Kart adı gerekli").max(60),
  phone: z.string().trim().min(1, "Telefon gerekli"),
  firstName: z.string().trim().max(80).nullable(),
  lastName: z.string().trim().max(80).nullable(),
  email: z.string().trim().max(200).email("Geçerli bir e-posta girin").nullable(),
  nationality: z.string().trim().length(2).nullable(),
  country: z.string().trim().length(2).nullable(),
  preferredLanguage: z.enum(GUEST_LOCALES).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  notes: z.string().trim().max(4000).nullable(),
})

export type PersonaFieldsInput = z.input<typeof personaFieldsSchema>

const PERSONA_SELECT =
  "id, label, phone, first_name, last_name, email, nationality, country, preferred_language, tags, notes"

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function toColumns(fields: z.output<typeof personaFieldsSchema>) {
  return {
    label: fields.label,
    phone: normalizePhoneE164(fields.phone),
    first_name: fields.firstName,
    last_name: fields.lastName,
    email: fields.email,
    nationality: fields.nationality?.toUpperCase() ?? null,
    country: fields.country?.toUpperCase() ?? null,
    preferred_language: fields.preferredLanguage,
    tags: fields.tags,
    notes: fields.notes,
  }
}

/** A phone that libphonenumber could not make sense of would break the avatar seed and every tool that takes a number. */
function validPhoneOrNull(raw: string): string | null {
  const e164 = normalizePhoneE164(raw)
  return e164.startsWith("+") && e164.length >= 8 ? e164 : null
}

export async function createPreviewPersonaAction(input: {
  organizationId: string
  fields: PersonaFieldsInput
}): Promise<Result<PreviewPersona>> {
  const parsed = personaFieldsSchema.safeParse(input.fields)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  if (!validPhoneOrNull(parsed.data.phone)) {
    return { ok: false, error: "Geçerli bir telefon numarası girin" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("assistant_preview_personas")
    .insert({
      organization_id: input.organizationId,
      ...toColumns(parsed.data),
      // New cards sort after the seeded ones.
      sort_order: 100,
    })
    .select(PERSONA_SELECT)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.code === "23505"
          ? "Bu telefon numarasıyla bir kart zaten var"
          : (error?.message ?? "Kaydedilemedi"),
    }
  }
  return { ok: true, value: rowToPersona(data) }
}

export async function updatePreviewPersonaAction(input: {
  personaId: string
  organizationId: string
  fields: PersonaFieldsInput
}): Promise<Result<PreviewPersona>> {
  const parsed = personaFieldsSchema.safeParse(input.fields)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  if (!validPhoneOrNull(parsed.data.phone)) {
    return { ok: false, error: "Geçerli bir telefon numarası girin" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("assistant_preview_personas")
    .update({ ...toColumns(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.personaId)
    .eq("organization_id", input.organizationId)
    .select(PERSONA_SELECT)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.code === "23505"
          ? "Bu telefon numarasıyla bir kart zaten var"
          : (error?.message ?? "Kaydedilemedi"),
    }
  }
  return { ok: true, value: rowToPersona(data) }
}

/**
 * Delete a card. Sessions that ran against it keep their own snapshot — the
 * foreign key is `on delete set null`, so past runs stay readable.
 */
export async function deletePreviewPersonaAction(input: {
  personaId: string
  organizationId: string
}): Promise<Result<null>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("assistant_preview_personas")
    .delete()
    .eq("id", input.personaId)
    .eq("organization_id", input.organizationId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, value: null }
}
