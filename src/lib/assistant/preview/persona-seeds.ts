import type { GuestLocale } from "@/lib/i18n/guest-locale"

/**
 * The cards an organization starts with.
 *
 * Each one exists to make a different assistant behaviour visible: a stranger it
 * knows nothing about, someone whose name and email it already has, a guest who
 * reads German, and a person the team has written a note about. Seeded once per
 * org and editable afterwards — they are examples, not fixtures.
 */

export interface PersonaSeed {
  label: string
  phone: string
  firstName?: string
  lastName?: string
  email?: string
  nationality?: string
  country?: string
  preferredLanguage?: GuestLocale
  tags?: string[]
  notes?: string
}

export const PERSONA_SEEDS: readonly PersonaSeed[] = [
  {
    // First contact: everything the assistant knows, it has to ask for.
    label: "Yeni ziyaretçi",
    phone: "+905321110001",
    country: "TR",
  },
  {
    // The team note is the point here — the assistant should warm up without
    // ever letting on that a note exists.
    label: "Sadık müşteri",
    phone: "+905321110002",
    firstName: "Ayşe",
    lastName: "Yıldırım",
    email: "ayse.yildirim@example.com",
    nationality: "TR",
    country: "TR",
    preferredLanguage: "tr",
    tags: ["VIP", "tekrar eden"],
    notes:
      "Üç yıldır her yaz bizde kalıyor, deniz manzaralı üst kat oda tercih ediyor. Sadık müşterimiz — mümkünse yer aç.",
  },
  {
    label: "Alman misafir",
    phone: "+4915112345678",
    firstName: "Lukas",
    nationality: "DE",
    country: "DE",
    preferredLanguage: "de",
  },
  {
    label: "Rus misafir",
    phone: "+79161234567",
    firstName: "Irina",
    nationality: "RU",
    country: "RU",
    preferredLanguage: "ru",
  },
  {
    // Full identity including an email, for flows that send something.
    label: "E-postalı yabancı misafir",
    phone: "+447400123456",
    firstName: "James",
    lastName: "Whitfield",
    email: "j.whitfield@example.com",
    nationality: "GB",
    country: "GB",
    preferredLanguage: "en",
    tags: ["ilk kez"],
  },
] as const
