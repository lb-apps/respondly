/** tr-TR clock, 24h: "10:27". */
export function formatClockTr(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso))
}

/** tr-TR: "4 Haz 2026, 10:27" — locale equivalent of "Jun 4, 2026, 10:27 AM". */
export function formatDateTimeTr(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
  const time = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
  return `${date}, ${time}`
}
