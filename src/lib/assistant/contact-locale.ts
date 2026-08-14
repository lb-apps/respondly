/**
 * One language per person, kept on their contact card.
 *
 * There used to be two ideas here and they never spoke to each other: a locale
 * detected from the current turn's text, which drove every reply, and a
 * `preferred_language` field on the contact card that staff could set and the
 * assistant could save — and which nothing ever read. A German guest whose card
 * said German got Turkish the moment they answered "ok".
 *
 * They are now the same thing, resolved in this order:
 *
 *   1. What they are writing *now*. A person switching language is stating a
 *      preference more clearly than any stored field, so this always wins.
 *   2. The card, which holds whatever the last understood message said, or what
 *      staff corrected it to.
 *   3. Their phone number's country, which is all we have before they write.
 *   4. The house language.
 *
 * Pure: the caller reads the card and writes it back, this only decides.
 */

import { localeFromPhone } from "@/lib/i18n/phone-locale"
import {
  normalizeGuestLocale,
  type GuestLocale,
} from "@/lib/i18n/guest-locale"

export interface ContactLocaleInput {
  /** Language of the customer's own words this turn, or null if unreadable. */
  detected?: GuestLocale | null
  /** `contacts.preferred_language` as stored. */
  preferred?: string | null
  /** E.164, for the country guess. */
  phone?: string | null
  /** The organization's own language, used when nothing else says. */
  houseLocale?: GuestLocale
}

export interface ContactLocaleDecision {
  /** What to reply in, label chrome in, and hand to connected systems. */
  locale: GuestLocale
  /**
   * The card is out of date and should be written back. True only when their
   * words settled it — a guess must never be saved as a preference, or the
   * phone number's country would harden into a fact nobody chose.
   */
  persist: boolean
}

export function resolveContactLocale(
  input: ContactLocaleInput
): ContactLocaleDecision {
  const house = input.houseLocale ?? "tr"
  const stored = input.preferred?.trim()
    ? normalizeGuestLocale(input.preferred, house)
    : null

  if (input.detected) {
    return { locale: input.detected, persist: input.detected !== stored }
  }

  if (stored) return { locale: stored, persist: false }

  // Nothing stored and nothing readable yet, so the number is what we have.
  // Worth writing down once: staff see a language on the card from the first
  // message, and their first real sentence overwrites it.
  const fromPhone = localeFromPhone(input.phone)
  if (fromPhone) return { locale: fromPhone, persist: true }

  // The house language is a default, not a finding. Never saved as a
  // preference — an unreadable number would otherwise harden into "Turkish".
  return { locale: house, persist: false }
}
