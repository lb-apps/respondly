import {
  normalizeGuestLocale,
  type GuestLocale,
} from "@/lib/i18n/guest-locale"

/**
 * Chrome the customer sees that the assistant did not write.
 *
 * Interactive messages need a couple of labels — the button that opens a list
 * sheet, the heading above a group of rows — and the model is asked to supply
 * them in the customer's language. When it does not, something still has to be
 * rendered, and a hardcoded Turkish word on a German conversation is a seam in
 * the illusion. These are the fallbacks, per language.
 *
 * Pure function. Guest-facing copy, so it lives beside the other guest-facing
 * strings rather than inline at the call sites.
 */

/** Opens the list sheet, and titles a section when rows are grouped. */
const OPTIONS: Record<GuestLocale, string> = {
  tr: "Seçenekler",
  en: "Options",
  de: "Optionen",
  ru: "Варианты",
}

export function optionsLabel(locale: string | null | undefined): string {
  return OPTIONS[normalizeGuestLocale(locale)]
}
