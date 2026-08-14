import {
  normalizeGuestLocale,
  type GuestLocale,
} from "@/lib/i18n/guest-locale"

/**
 * What we tell the customer when a human takes over.
 *
 * Handing off is a promise, not a state change: the conversation stops being
 * answered and the person on the other end has no way of knowing that unless we
 * say so. Silence reads as being ignored — which is worse than any wrong answer.
 *
 * Two situations need it. The assistant usually writes its own handoff line and
 * this is only the safety net for when it produced nothing; a turn that crashed
 * has no line at all and always uses this. Pure function, no I/O.
 */

/** The assistant answered nothing and a colleague is picking it up. */
const HANDOFF: Record<GuestLocale, string> = {
  tr: "Bu konuyu bir arkadaşıma aktarıyorum, kısa süre içinde size dönecek.",
  en: "I'm passing this to a colleague — they'll get back to you shortly.",
  de: "Ich gebe das an eine Kollegin weiter, sie meldet sich in Kürze bei Ihnen.",
  ru: "Передаю ваш вопрос коллеге — он свяжется с вами в ближайшее время.",
}

/**
 * Something broke on our side. Deliberately not an apology for "a technical
 * error": the customer does not care which of our systems failed, only that a
 * person is now on it.
 */
const FAILURE: Record<GuestLocale, string> = {
  tr: "Bu konuyu bir arkadaşıma aktardım, en kısa sürede size dönecek.",
  en: "I've passed this to a colleague — they'll get back to you as soon as possible.",
  de: "Ich habe das an eine Kollegin weitergegeben, sie meldet sich schnellstmöglich.",
  ru: "Я передал ваш вопрос коллеге — он ответит вам в ближайшее время.",
}

export type HandoffReason = "no_answer" | "failure"

/** The line to send, in the customer's language. */
export function handoffMessage(
  locale: string | null | undefined,
  reason: HandoffReason = "no_answer"
): string {
  const key = normalizeGuestLocale(locale)
  return reason === "failure" ? FAILURE[key] : HANDOFF[key]
}
