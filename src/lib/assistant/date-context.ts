/** YYYY-MM-DD in the given IANA timezone. */
export function isoDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Add calendar days to an ISO date (YYYY-MM-DD). */
export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(utc.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

export interface ResolvedOrgDates {
  timezone: string
  weekday: string
  today: string
  tomorrow: string
}

export function resolveOrgDates(now: Date, timezone: string): ResolvedOrgDates {
  const today = isoDateInTimezone(now, timezone)
  return {
    timezone,
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(now),
    today,
    tomorrow: addCalendarDays(today, 1),
  }
}
