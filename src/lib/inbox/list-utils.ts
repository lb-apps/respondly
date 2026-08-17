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

/**
 * Whether a freshly inserted message row moves the conversation list at all.
 *
 * A `system` row is a timeline event: it belongs inside the thread and nowhere
 * else. `sync_conversation_last_message` already refuses to move
 * `last_message_at` for one, so patching the list optimistically would bump the
 * conversation to the top under someone else's words for the ~400 ms until the
 * refresh puts it back.
 *
 * A row whose role we cannot read counts as a message: failing open leaves the
 * list a little noisy, failing closed would silently hide real traffic.
 */
export function messageRowBumpsList(row: { role?: string | null }): boolean {
  return row.role !== "system"
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

/**
 * Whether a `conversations` change has to be answered with an RSC refetch, or
 * whether patching the row in place is the whole story.
 *
 * Every column this list shows is covered by `patchConversationFromRealtimeRow`,
 * so most of these events need no server round trip at all. That matters more
 * than it sounds: marking a thread read writes this row, which echoes straight
 * back as an UPDATE — refetching on every event meant the inbox refreshed
 * itself in response to its own write, once per thread opened. An assistant
 * turn cost two more, taking and releasing `turn_locked_at`.
 *
 * What the patch cannot cover is what the *server* render owns: the thread's
 * own status badge, and the name, which is resolved from the contact card
 * rather than from this row. Those two are the refetch.
 */
export function conversationRowNeedsRefetch(
  prev: { status: string },
  row: Record<string, unknown>
): boolean {
  // Status alone. A rename is deliberately not tested here: `guest_name` is the
  // frozen WhatsApp push name while the row we hold shows the contact card's
  // name, so the two differ permanently on every thread staff has ever renamed
  // — comparing them would refetch on every message those guests send. Renames
  // arrive on the `contacts` channel instead, which refetches.
  return typeof row.status === "string" && row.status !== prev.status
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
