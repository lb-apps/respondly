export type InboxFilter = "all" | "unread" | "needs_human"

/**
 * How long a held turn lock is believed. Mirrors the interval in
 * `try_claim_conversation_turn`, which lets another worker steal a lock this
 * old — past it the turn is presumed dead, so the indicator must stop claiming
 * the assistant is still writing.
 */
export const TURN_LOCK_TTL_MS = 2 * 60 * 1000

/** Whether an assistant turn is running right now, per its lock timestamp. */
export function isAssistantTyping(
  turnLockedAt: string | null,
  now: number = Date.now()
): boolean {
  if (!turnLockedAt) return false
  const started = new Date(turnLockedAt).getTime()
  if (Number.isNaN(started)) return false
  return now - started < TURN_LOCK_TTL_MS
}

export const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  bot: { label: "Bot", variant: "secondary" },
  needs_human: { label: "Devir bekliyor", variant: "destructive" },
  human: { label: "Ekip", variant: "default" },
  closed: { label: "Kapalı", variant: "outline" },
}

export function initials(name: string | null, phone: string): string {
  const source = name?.trim() || phone
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  const compact = source.replace(/[^\p{L}\p{N}]/gu, "")
  return compact.slice(0, 2).toUpperCase() || "?"
}

export function formatListTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 6)

  if (d >= startOfToday) {
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  }
  if (d >= startOfYesterday) return "Dün"
  if (d >= startOfWeek) {
    return new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(d)
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(d)
}

export function formatWaitDuration(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes} dk bekliyor`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} sa bekliyor`
  const days = Math.floor(hours / 24)
  return `${days} gün bekliyor`
}

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

/**
 * Fold a freshly loaded set of messages into the ones already on screen.
 *
 * A thread is read from two directions at once: the server keeps handing back
 * the newest page (every realtime event refreshes it) while the reader pages
 * backwards through history. Neither side alone is the truth — once a few new
 * messages arrive, the newest page no longer reaches back to where the reader
 * had scrolled, and dropping what fell between them would tear a hole in the
 * middle of the conversation. So pages accumulate, keyed by id.
 *
 * Ordering repeats the query's: `created_at`, then `id` for the messages that
 * share a millisecond.
 */
export function mergeThreadMessages<T extends { id: string; createdAt: string }>(
  existing: readonly T[],
  incoming: readonly T[]
): T[] {
  const byId = new Map<string, T>()
  for (const m of existing) byId.set(m.id, m)
  // Later wins: a refreshed row carries newer content than the copy on screen.
  for (const m of incoming) byId.set(m.id, m)

  return [...byId.values()].sort((a, b) =>
    a.createdAt === b.createdAt
      ? a.id.localeCompare(b.id)
      : a.createdAt < b.createdAt
        ? -1
        : 1
  )
}

export function channelLabel(kind: string | null): string {
  if (!kind) return "Kanal"
  if (kind === "whatsapp") return "WhatsApp"
  if (kind === "instagram") return "Instagram"
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

/** WhatsApp-style inbox order: pinned first, then most recent activity. */
export function sortInboxConversations<
  T extends { pinnedAt: string | null; lastMessageAt: string },
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const aPinned = a.pinnedAt != null
    const bPinned = b.pinnedAt != null
    if (aPinned !== bPinned) return aPinned ? -1 : 1

    if (a.pinnedAt && b.pinnedAt) {
      const pinDelta =
        new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime()
      if (pinDelta !== 0) return pinDelta
    }

    return (
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )
  })
}

/** Preview line for a newly inserted message row (matches server truncation). */
export function messagePreviewFromInsert(row: {
  body?: string | null
  type?: string | null
  metadata?: unknown
}): string {
  const body = row.body?.trim() ?? ""
  if (body) return body.slice(0, 160)

  const meta = row.metadata
  if (meta && typeof meta === "object" && "attachments" in meta) {
    const attachments = (meta as { attachments?: unknown }).attachments
    if (Array.isArray(attachments) && attachments.length > 0) {
      const first = attachments[0] as { filename?: string } | undefined
      return `📎 ${first?.filename ?? "Ek"}`.slice(0, 160)
    }
  }

  if (row.type === "media") return "📎 Ek"
  return "—"
}

export function patchConversationFromRealtimeRow<
  T extends {
    guestName: string | null
    guestPhone: string
    status: string
    language: string
    lastMessageAt: string
    lastMessagePreview: string | null
    unreadCount: number
    pinnedAt: string | null
    channelKind: string | null
    turnLockedAt: string | null
  },
>(prev: T, row: Record<string, unknown>): T {
  return {
    ...prev,
    // The name is deliberately not patched from this row. It comes from the
    // contact card, and `conversations.guest_name` is the WhatsApp push name
    // frozen at creation — patching it here rewrote a corrected name back to
    // the old one on every message, because every message touches this row.
    // A rename arrives instead as a `contacts` change, which refetches.
    guestPhone:
      typeof row.guest_phone === "string" ? row.guest_phone : prev.guestPhone,
    status: typeof row.status === "string" ? row.status : prev.status,
    language: typeof row.language === "string" ? row.language : prev.language,
    lastMessageAt:
      typeof row.last_message_at === "string"
        ? row.last_message_at
        : prev.lastMessageAt,
    lastMessagePreview:
      typeof row.last_message_preview === "string" ||
      row.last_message_preview === null
        ? row.last_message_preview
        : prev.lastMessagePreview,
    unreadCount:
      typeof row.unread_count === "number"
        ? row.unread_count
        : prev.unreadCount,
    pinnedAt:
      typeof row.pinned_at === "string" || row.pinned_at === null
        ? row.pinned_at
        : prev.pinnedAt,
    // Taken and released around every assistant turn, so this row arrives twice
    // per reply — which is exactly what makes "yazıyor…" appear and disappear
    // without waiting for a refetch.
    turnLockedAt:
      typeof row.turn_locked_at === "string" || row.turn_locked_at === null
        ? row.turn_locked_at
        : prev.turnLockedAt,
  }
}

export function matchesFilter(
  item: {
    status: string
    unreadCount: number
  },
  filter: InboxFilter
): boolean {
  switch (filter) {
    case "all":
      return true
    case "unread":
      return item.unreadCount > 0
    case "needs_human":
      return item.status === "needs_human"
    default:
      return true
  }
}

export function filterConversations<
  T extends {
    id: string
    guestName: string | null
    guestPhone: string
    lastMessagePreview: string | null
    status: string
    unreadCount: number
    pinnedAt: string | null
    lastMessageAt: string
  },
>(items: T[], query: string, filter: InboxFilter): T[] {
  const q = query.trim().toLowerCase()
  const result: T[] = []

  for (const item of items) {
    if (!matchesFilter(item, filter)) continue
    if (q) {
      const haystack = [
        item.guestName ?? "",
        item.guestPhone,
        item.lastMessagePreview ?? "",
      ]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(q)) continue
    }
    result.push(item)
  }

  return sortInboxConversations(result)
}
