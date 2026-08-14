import { z } from "zod"
import {
  PROFILE_ABOUT_MAX,
  PROFILE_ADDRESS_MAX,
  PROFILE_DESCRIPTION_MAX,
  PROFILE_EMAIL_MAX,
  PROFILE_WEBSITE_MAX,
  WHATSAPP_VERTICALS,
} from "@/lib/whatsapp/cloud-api/business-profile-limits"

/**
 * Single source of truth for the WhatsApp business profile form — imported by
 * the client form (react-hook-form resolver) and by the server action (trusted
 * re-validation). Same contract as `../mcp/schema.ts`.
 *
 * Every field is a required string that may be empty rather than `.optional()`:
 * react-hook-form wants stable field types, and an empty string is also how
 * Meta clears a profile field. The action decides per field whether to omit it
 * or send `""`.
 */

const website = z
  .string()
  .trim()
  .max(PROFILE_WEBSITE_MAX, `En fazla ${PROFILE_WEBSITE_MAX} karakter`)
  .refine(
    (value) => value === "" || /^https?:\/\/[^\s.]+\.[^\s]+$/.test(value),
    "Geçerli bir adres girin (https:// ile başlamalı)"
  )

const profileBaseSchema = z.object({
  about: z
    .string()
    .trim()
    .max(PROFILE_ABOUT_MAX, `En fazla ${PROFILE_ABOUT_MAX} karakter`),
  description: z
    .string()
    .trim()
    .max(PROFILE_DESCRIPTION_MAX, `En fazla ${PROFILE_DESCRIPTION_MAX} karakter`),
  address: z
    .string()
    .trim()
    .max(PROFILE_ADDRESS_MAX, `En fazla ${PROFILE_ADDRESS_MAX} karakter`),
  email: z
    .string()
    .trim()
    .max(PROFILE_EMAIL_MAX, `En fazla ${PROFILE_EMAIL_MAX} karakter`)
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Geçerli bir e-posta girin"
    ),
  vertical: z.enum(WHATSAPP_VERTICALS, { message: "Sektör seçin" }),
  /**
   * Two flat fields rather than an array: Meta stores at most two, and two
   * labelled inputs read better than a repeater whose add button disables
   * itself after one click. `sanitizeWebsites` reassembles the list.
   */
  website1: website,
  website2: website,
})

export const profileFormSchema = profileBaseSchema
export type ProfileFormValues = z.infer<typeof profileBaseSchema>

export const saveProfileSchema = profileBaseSchema.extend({
  channelId: z.string().uuid(),
  slug: z.string().min(1),
})

export type SaveProfileInput = z.input<typeof saveProfileSchema>

/** Meta's business categories, in Turkish. Keys come from WHATSAPP_VERTICALS. */
export const VERTICAL_LABELS: Record<string, string> = {
  OTHER: "Diğer",
  AUTO: "Otomotiv",
  BEAUTY: "Güzellik ve kişisel bakım",
  APPAREL: "Giyim",
  EDU: "Eğitim",
  ENTERTAIN: "Eğlence",
  EVENT_PLAN: "Etkinlik ve organizasyon",
  FINANCE: "Finans ve bankacılık",
  GROCERY: "Market",
  GOVT: "Kamu",
  HOTEL: "Otel ve konaklama",
  HEALTH: "Sağlık",
  NONPROFIT: "Kâr amacı gütmeyen",
  PROF_SERVICES: "Profesyonel hizmetler",
  RETAIL: "Perakende",
  TRAVEL: "Seyahat ve ulaşım",
  RESTAURANT: "Restoran",
  ALCOHOL: "Alkollü içecek",
  ONLINE_GAMBLING: "Çevrim içi bahis ve oyun",
  PHYSICAL_GAMBLING: "Fiziksel bahis ve oyun",
  OTC_DRUGS: "Reçetesiz ilaç",
}

export const QUALITY_LABELS: Record<string, string> = {
  GREEN: "Yüksek",
  YELLOW: "Orta",
  RED: "Düşük",
  UNKNOWN: "Bilinmiyor",
}

/**
 * The theme carries no green or amber token, so a literal traffic light is not
 * expressible without inventing colours. The word carries the meaning and only
 * the state that needs alarm gets colour — which also passes SC 1.4.1, where
 * colour alone would not.
 */
export const QUALITY_VARIANTS: Record<
  string,
  "secondary" | "outline" | "destructive"
> = {
  GREEN: "secondary",
  YELLOW: "outline",
  RED: "destructive",
}

export const NAME_STATUS_LABELS: Record<string, string> = {
  APPROVED: "Onaylı",
  PENDING_REVIEW: "İncelemede",
  DECLINED: "Reddedildi",
  EXPIRED: "Süresi doldu",
  AVAILABLE_WITHOUT_REVIEW: "Onaysız kullanılabilir",
  NONE: "Yok",
}

export const MESSAGING_TIER_LABELS: Record<string, string> = {
  TIER_50: "Günde 50 kişi",
  TIER_250: "Günde 250 kişi",
  TIER_1K: "Günde 1.000 kişi",
  TIER_10K: "Günde 10.000 kişi",
  TIER_100K: "Günde 100.000 kişi",
  TIER_UNLIMITED: "Sınırsız",
}

export const CODE_VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "Doğrulandı",
  NOT_VERIFIED: "Doğrulanmadı",
  EXPIRED: "Süresi doldu",
}
