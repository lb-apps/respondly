/**
 * Guest conversation locales the assistant can detect and reply in.
 *
 * SOLID: this is the app-wide language contract — nothing about it belongs to a
 * particular integration. Channels, prompts and rich content all speak this type.
 */
export const GUEST_LOCALES = ["tr", "en", "de", "ru"] as const

export type GuestLocale = (typeof GUEST_LOCALES)[number]

export const GUEST_LOCALE_LABELS: Record<GuestLocale, string> = {
  tr: "Turkish",
  en: "English",
  de: "German",
  ru: "Russian",
}

export function isGuestLocale(value: unknown): value is GuestLocale {
  return (
    typeof value === "string" && GUEST_LOCALES.includes(value as GuestLocale)
  )
}

/** Coerce anything (BCP-47 tag, DB column, user input) into a supported locale. */
export function normalizeGuestLocale(
  locale: string | null | undefined,
  fallback: GuestLocale = "tr"
): GuestLocale {
  const key = locale?.trim().toLowerCase().slice(0, 2)
  return isGuestLocale(key) ? key : fallback
}
