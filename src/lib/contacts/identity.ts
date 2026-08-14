import { z } from "zod"
import { GUEST_LOCALES, type GuestLocale } from "@/lib/i18n/guest-locale"

/**
 * What we record about a person, and nothing more.
 *
 * Deliberately small: an identity, how to reach them, and how to address them.
 * Anything situational (dates, party size, preferences) belongs to the systems
 * that own it — the assistant reads those over MCP rather than hoarding a copy
 * that silently goes stale.
 */

/** ISO 3166-1 alpha-2, upper-cased. */
export const countryCodeSchema = z
  .string()
  .trim()
  .length(2, "İki harfli ülke kodu girin")
  .transform((value) => value.toUpperCase())

export const contactIdentitySchema = z.object({
  firstName: z.string().trim().max(80).nullable(),
  lastName: z.string().trim().max(80).nullable(),
  email: z.string().trim().email("Geçerli bir e-posta girin").nullable(),
  /** Where they are from, as they state it. */
  nationality: countryCodeSchema.nullable(),
  /** Seeded from the phone number at creation, editable afterwards. */
  country: countryCodeSchema.nullable(),
  /** The language we should write to them in. */
  preferredLanguage: z.enum(GUEST_LOCALES).nullable(),
})

export type ContactIdentity = z.infer<typeof contactIdentitySchema>

export const PREFERRED_LANGUAGE_LABELS: Record<GuestLocale, string> = {
  tr: "Türkçe",
  en: "İngilizce",
  de: "Almanca",
  ru: "Rusça",
}

/** Display name built the same way the DB trigger builds it. */
export function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string | null {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : null
}
