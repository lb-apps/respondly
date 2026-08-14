import {
  GUEST_LOCALE_LABELS,
  type GuestLocale,
} from "@/lib/i18n/guest-locale"

/** High-priority per-turn language anchor appended after the static system prompt. */
export function buildGuestLanguagePromptBlock(locale: GuestLocale): string {
  const label = GUEST_LOCALE_LABELS[locale]
  return `## Active Conversation Language (this turn)

The guest is currently writing in **${label}** (locale: ${locale}).
Write your **entire** reply in ${label} — including confirmations after tool calls, link button labels, quick-reply button labels, and short follow-ups like "great choice".
Never switch to Turkish unless the guest's latest message is in Turkish.`
}
