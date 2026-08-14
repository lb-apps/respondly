/**
 * A first guess at someone's language, from their phone number.
 *
 * The moment a stranger messages, all we know is the number — and its dialling
 * code names a country, which names a language often enough to be worth using
 * until they write something we can read. A German number gets German, a
 * Kazakh one Russian; both are corrected the instant their first real sentence
 * is understood.
 *
 * The country-to-language step needs no dependency and no table of our own:
 * CLDR ships exactly this mapping as its "likely subtags" data, and `Intl`
 * carries it. `und-AT` maximises to `de-Latn-AT`, `und-KZ` to `ru-Cyrl-KZ` —
 * answers a hand-written map would get wrong.
 */

import { getPhoneCountry } from "@/lib/phone"
import { isGuestLocale, type GuestLocale } from "@/lib/i18n/guest-locale"

/**
 * What a foreign number gets when we do not speak its language.
 *
 * A French number is far more likely to want English than Turkish, which is
 * what the plain fallback would hand them.
 */
const FOREIGN_FALLBACK: GuestLocale = "en"

/**
 * The language this number suggests, or null when it suggests nothing —
 * an unparseable number, or one with no country.
 */
export function localeFromPhone(
  phone: string | null | undefined
): GuestLocale | null {
  const country = getPhoneCountry(phone)
  if (!country) return null

  let language: string
  try {
    language = new Intl.Locale(`und-${country}`).maximize().language
  } catch {
    return null
  }

  if (isGuestLocale(language)) return language
  // A country whose language we cannot speak is still a country we know is not
  // ours — English serves them better than the house language.
  return FOREIGN_FALLBACK
}
