/**
 * Timezone options + helpers for the assistant config UI.
 *
 * The assistant's authoritative "today" is computed in this timezone (see
 * `buildDateContext` in `src/mastra/prompt.ts`). The UI lets staff pick it; the
 * value is stored per-assistant in `assistants.settings.timezone`.
 *
 * SOLID: single responsibility — present timezone choices and format a
 * human-readable date for the picker. No I/O.
 */

/** Curated IANA zones shown by default in the picker (before search). */
export const COMMON_TIMEZONES: { id: string; label: string }[] = [
  { id: "Europe/Istanbul", label: "İstanbul" },
  { id: "Europe/London", label: "Londra" },
  { id: "Europe/Berlin", label: "Paris / Berlin" },
  { id: "Europe/Athens", label: "Atina / Kahire" },
  { id: "Asia/Dubai", label: "Dubai / Abu Dabi" },
  { id: "Asia/Riyadh", label: "Riyad / Kuveyt" },
  { id: "America/New_York", label: "New York (Doğu)" },
  { id: "America/Los_Angeles", label: "Los Angeles (Batı)" },
]

/**
 * Full IANA zone list for search. `Intl.supportedValuesOf` is available in
 * modern runtimes; fall back to the curated list otherwise.
 */
export const ALL_TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : COMMON_TIMEZONES.map((t) => t.id)

/**
 * Human-readable date in the given timezone, e.g. "Cuma, 26 Haziran 2026".
 *
 * Date granularity only (no clock time) — this mirrors exactly what the
 * assistant receives in its system prompt, which is intentionally date-only.
 */
export function formatZonedDate(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now)
  } catch {
    // Invalid timezone string — surface something rather than throwing.
    return new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now)
  }
}
