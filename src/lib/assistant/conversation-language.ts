import {
  isGuestLocale,
  normalizeGuestLocale,
  type GuestLocale,
} from "@/lib/i18n/guest-locale"

type TextContent = string | Array<{ type?: string; text?: string }>

/** Pull plain guest text from a model-history message body. */
export function extractGuestText(content: TextContent): string {
  if (typeof content === "string") return content.trim()
  if (!Array.isArray(content)) return ""
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join("\n")
    .trim()
}

function isAmbiguousGuestText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (/^[\p{Emoji}\p{Emoji_Presentation}\s]+$/u.test(trimmed)) return true
  if (/^(ok|okay|k|thanks|thx|👍|🙏)$/i.test(trimmed)) return true
  if (/^(hello|hi|hey)$/i.test(trimmed)) return true
  return false
}

/** Best-effort locale guess from one guest message (supported guest locales). */
export function detectLocaleFromText(text: string): GuestLocale | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  if (/[\u0400-\u04FF]/.test(trimmed)) return "ru"
  if (/[şğıöüçŞĞİÖÜÇ]/.test(trimmed)) return "tr"
  if (/[äöüßÄÖÜ]/.test(trimmed)) return "de"

  const lower = trimmed.toLowerCase()

  const trSignals =
    /\b(merhaba|selam|günaydın|iyi akşamlar|oda|odalar|gece|kişi|yetişkin|çocuk|fiyat|rezervasyon|giriş|çıkış|kahvaltı|otopark|var mı|müsait|yarın|bugün)\b/u
  const enSignals =
    /\b(hello|hi|hey|good morning|good|great|perfect|yes|sure|fine|suite|room|rooms|night|nights|adult|adults|child|children|price|booking|book|check-in|check-out|checkout|available|availability|parking|tomorrow|today|thank you|thanks|please|want|would|like|love|sounds|works|also|very|really|can|could|have|has|is|are|was|the|this|that|my|your|our|we|you|sea-view|sea view)\b/
  const deSignals =
    /\b(hallo|guten tag|zimmer|nacht|nächte|preis|buchung|verfügbar|parkplatz|morgen|heute|danke)\b/
  const ruSignals =
    /\b(привет|номер|ночь|цена|бронирование|завтра|сегодня)\b/u

  let tr = 0
  let en = 0
  let de = 0
  let ru = 0
  if (trSignals.test(lower)) tr += 2
  if (enSignals.test(lower)) en += 2
  if (deSignals.test(lower)) de += 2
  if (ruSignals.test(lower)) ru += 2
  if (/\b(mı|mi|mu|mü)\b/u.test(lower)) tr += 1

  const max = Math.max(tr, en, de, ru)
  if (max === 0) return null
  if (tr === max) return "tr"
  if (en === max) return "en"
  if (de === max) return "de"
  if (ru === max) return "ru"

  if (looksLikeLatinEnglish(trimmed)) return "en"
  return null
}

/** Short Latin-script replies with no TR/DE/RU markers (e.g. "suite is good"). */
function looksLikeLatinEnglish(text: string): boolean {
  if (/[şğıöüçŞĞİÖÜÇäöüß\u0400-\u04FF]/.test(text)) return false
  if (!/[a-zA-Z]{2,}/.test(text)) return false
  const lower = text.toLowerCase()
  return /\b(the|a|an|is|are|was|were|have|has|had|for|with|this|that|good|great|yes|no|please|want|would|like|suite|room|rooms|book|night|ok|okay|sure|perfect|fine|sounds|works|can|could|do|does|my|your|our|we|i|you|it|not|very|really|also|just|love)\b/.test(
    lower
  )
}

/**
 * Mirror the assistant prompt language rules for the turn's guest locale.
 * Uses the latest unambiguous guest message; ambiguous latest → prior guest turn.
 */
export function resolveGuestLocaleFromTexts(
  guestTexts: string[],
  fallback: GuestLocale = "tr"
): GuestLocale {
  if (guestTexts.length === 0) return fallback

  for (let i = guestTexts.length - 1; i >= 0; i--) {
    const text = guestTexts[i]
    const isLatest = i === guestTexts.length - 1
    if (isLatest && isAmbiguousGuestText(text)) continue
    if (!isLatest && isAmbiguousGuestText(text)) continue

    const detected = detectLocaleFromText(text)
    if (detected) return detected
  }

  for (let i = guestTexts.length - 1; i >= 0; i--) {
    const detected = detectLocaleFromText(guestTexts[i])
    if (detected) return detected
  }

  return fallback
}

export function resolveGuestLocaleFromMessages(
  messages: Array<{ role: string; content: TextContent }>,
  fallback: GuestLocale = "tr"
): GuestLocale {
  return (
    detectGuestLocaleFromMessages(messages) ??
    normalizeGuestLocale(fallback, fallback)
  )
}

/**
 * The language the customer is actually writing in, or null when nothing they
 * have sent says.
 *
 * Separate from `resolveGuestLocaleFromMessages` because the difference between
 * "they wrote German" and "we guessed" decides whether their contact card gets
 * rewritten. A thread of "ok" and thumbs-up must not overwrite what we know.
 */
export function detectGuestLocaleFromMessages(
  messages: Array<{ role: string; content: TextContent }>
): GuestLocale | null {
  const guestTexts = messages
    .filter((message) => message.role === "user" || message.role === "guest")
    .map((message) => extractGuestText(message.content))
    .filter(Boolean)

  if (guestTexts.length === 0) return null

  const MISSING = "__none__"
  const resolved = resolveGuestLocaleFromTexts(
    guestTexts,
    MISSING as unknown as GuestLocale
  )
  return isGuestLocale(resolved) ? resolved : null
}

/** Locale for rendering a bubble at `upToIndex` (inclusive) in a chat thread. */
export function resolveGuestLocaleForThread(
  messages: Array<{ role: string; text: string }>,
  upToIndex: number,
  fallback: GuestLocale = "tr"
): GuestLocale {
  const guestTexts = messages
    .slice(0, upToIndex + 1)
    .filter((message) => message.role === "user" || message.role === "guest")
    .map((message) => message.text.trim())
    .filter(Boolean)

  return normalizeGuestLocale(
    resolveGuestLocaleFromTexts(guestTexts, fallback),
    fallback
  )
}
