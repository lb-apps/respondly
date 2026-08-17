import { fullName, PREFERRED_LANGUAGE_LABELS } from "@/lib/contacts/identity"
import { isGuestLocale, normalizeGuestLocale } from "@/lib/i18n/guest-locale"
import { formatPhoneDisplay } from "@/lib/phone"
import type { PreviewPersona } from "@/lib/supabase/queries/preview-personas"

/**
 * How a persona reads on screen.
 *
 * Pure and shared, so the picker card, the active badge and the message bubbles
 * all name the same person the same way — and so `name` stays derived from
 * first/last exactly as the `contacts` trigger derives it.
 */

/** The guest's own name, or their number when we do not know it yet. */
export function personaDisplayName(persona: PreviewPersona): string {
  return (
    fullName(persona.firstName, persona.lastName) ??
    formatPhoneDisplay(persona.phone)
  )
}

/** Turkish label for the card's language, or null when it is left to detection. */
export function personaLanguageLabel(persona: PreviewPersona): string | null {
  const preferred = persona.preferredLanguage?.trim()
  if (!preferred || !isGuestLocale(preferred)) return null
  return PREFERRED_LANGUAGE_LABELS[normalizeGuestLocale(preferred)]
}
