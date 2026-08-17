/**
 * Cutting a thread into days.
 *
 * Lives under `chat/` rather than `inbox/` because the shared `ThreadView` uses
 * it, and a component both surfaces render must not reach into one of them.
 */

/** Stable per-calendar-day key (local time) for grouping a thread. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * Sticky day-divider label with a date, e.g. "Bugün, 20 Ocak" / "Dün, 19 Ocak"
 * / "Pazartesi, 18 Ocak" (this week) / "20 Ocak 2026" (older).
 */
export function formatDayHeading(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 6)
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const date = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(d)

  if (startOfDay.getTime() === startOfToday.getTime()) return `Bugün, ${date}`
  if (startOfDay.getTime() === startOfYesterday.getTime()) return `Dün, ${date}`
  if (startOfDay >= startOfWeek) {
    const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(d)
    return `${weekday}, ${date}`
  }
  return date
}

export type DayGroup<T> = { key: string; label: string; items: T[] }

/**
 * Group chronologically-ordered items into consecutive per-day buckets.
 * Assumes `items` is already sorted ascending by timestamp.
 */
export function groupByDay<T>(
  items: readonly T[],
  getIso: (item: T) => string
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const item of items) {
    const iso = getIso(item)
    const key = dayKey(iso)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.items.push(item)
    } else {
      groups.push({ key, label: formatDayHeading(iso), items: [item] })
    }
  }
  return groups
}
