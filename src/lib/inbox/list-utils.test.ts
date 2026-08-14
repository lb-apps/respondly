import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  isAssistantTyping,
  mergeThreadMessages,
  TURN_LOCK_TTL_MS,
  patchConversationFromRealtimeRow,
  dayKey,
  formatDayHeading,
  groupByDay,
  sortInboxConversations,
} from "@/lib/inbox/list-utils"

function isoDaysAgo(days: number, hour = 12): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

describe("dayKey", () => {
  it("is stable within a calendar day and differs across days", () => {
    const morning = new Date(2026, 0, 20, 8, 30).toISOString()
    const evening = new Date(2026, 0, 20, 22, 15).toISOString()
    const nextDay = new Date(2026, 0, 21, 1, 0).toISOString()
    assert.equal(dayKey(morning), dayKey(evening))
    assert.notEqual(dayKey(morning), dayKey(nextDay))
  })
})

describe("formatDayHeading", () => {
  it("labels today and yesterday with a date", () => {
    assert.match(formatDayHeading(isoDaysAgo(0)), /^Bugün, /)
    assert.match(formatDayHeading(isoDaysAgo(1)), /^Dün, /)
  })

  it("returns a non-empty label for older dates", () => {
    assert.ok(formatDayHeading(isoDaysAgo(400)).length > 0)
  })
})

describe("groupByDay", () => {
  it("buckets consecutive same-day items together", () => {
    const items = [
      { id: "a", at: new Date(2026, 0, 20, 9).toISOString() },
      { id: "b", at: new Date(2026, 0, 20, 18).toISOString() },
      { id: "c", at: new Date(2026, 0, 21, 8).toISOString() },
    ]
    const groups = groupByDay(items, (i) => i.at)
    assert.equal(groups.length, 2)
    assert.deepEqual(
      groups[0]!.items.map((i) => i.id),
      ["a", "b"]
    )
    assert.deepEqual(
      groups[1]!.items.map((i) => i.id),
      ["c"]
    )
  })

  it("returns an empty array for no items", () => {
    assert.deepEqual(groupByDay([], (i: { at: string }) => i.at), [])
  })
})

describe("sortInboxConversations", () => {
  it("orders by last activity, pinned threads first", () => {
    const sorted = sortInboxConversations([
      {
        id: "a",
        pinnedAt: null,
        lastMessageAt: "2026-07-06T10:00:00.000Z",
      },
      {
        id: "b",
        pinnedAt: "2026-07-05T12:00:00.000Z",
        lastMessageAt: "2026-07-04T10:00:00.000Z",
      },
      {
        id: "c",
        pinnedAt: null,
        lastMessageAt: "2026-07-06T12:00:00.000Z",
      },
    ])

    assert.deepEqual(
      sorted.map((c) => c.id),
      ["b", "c", "a"]
    )
  })
})

describe("patchConversationFromRealtimeRow", () => {
  const row = {
    guestName: "Emirhan Erdoğan",
    guestPhone: "+33766151513",
    status: "bot",
    language: "tr",
    lastMessageAt: "2026-08-13T10:00:00Z",
    lastMessagePreview: "Merhaba",
    unreadCount: 0,
    pinnedAt: null,
    channelKind: "whatsapp",
    turnLockedAt: null,
  }

  it("keeps the name staff corrected when a new message arrives", () => {
    // Every message updates the conversation row, and that row still carries
    // the WhatsApp push name from the day the thread opened. Patching it back
    // is what made a renamed contact revert in the list.
    const patched = patchConversationFromRealtimeRow(row, {
      guest_name: "emirhan",
      last_message_at: "2026-08-13T10:05:00Z",
      last_message_preview: "Teşekkürler",
    })
    assert.equal(patched.guestName, "Emirhan Erdoğan")
    assert.equal(patched.lastMessagePreview, "Teşekkürler")
  })

  it("still takes everything else from the row", () => {
    const patched = patchConversationFromRealtimeRow(row, {
      status: "needs_human",
      unread_count: 3,
    })
    assert.equal(patched.status, "needs_human")
    assert.equal(patched.unreadCount, 3)
  })
})

describe("mergeThreadMessages", () => {
  const msg = (id: string, createdAt: string, body = id) => ({ id, createdAt, body })

  it("keeps history the newest page no longer reaches", () => {
    // What the reader had on screen: an older page they scrolled to, plus the
    // page the server gave them at open.
    const onScreen = [msg("a", "2026-08-13T10:00:00Z"), msg("b", "2026-08-13T10:01:00Z")]
    // Four messages later the server's newest page starts after "b".
    const refreshed = [msg("c", "2026-08-13T10:02:00Z"), msg("d", "2026-08-13T10:03:00Z")]

    assert.deepEqual(
      mergeThreadMessages(onScreen, refreshed).map((m) => m.id),
      ["a", "b", "c", "d"]
    )
  })

  it("prefers the freshly loaded copy of a message it already had", () => {
    const merged = mergeThreadMessages(
      [msg("a", "2026-08-13T10:00:00Z", "eski")],
      [msg("a", "2026-08-13T10:00:00Z", "yeni")]
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0].body, "yeni")
  })

  it("breaks a shared timestamp by id, the way the query does", () => {
    const same = "2026-08-13T10:00:00Z"
    assert.deepEqual(
      mergeThreadMessages([msg("b2", same)], [msg("a1", same)]).map((m) => m.id),
      ["a1", "b2"]
    )
  })

  it("returns the incoming page as-is when nothing is on screen", () => {
    const page = [msg("a", "2026-08-13T10:00:00Z"), msg("b", "2026-08-13T10:01:00Z")]
    assert.deepEqual(mergeThreadMessages([], page).map((m) => m.id), ["a", "b"])
  })
})

describe("isAssistantTyping", () => {
  const lockedAt = "2026-08-13T10:00:00Z"
  const started = Date.parse(lockedAt)

  it("is on while the turn holds its lock", () => {
    assert.equal(isAssistantTyping(lockedAt, started + 3_000), true)
  })

  it("is off with no lock at all", () => {
    assert.equal(isAssistantTyping(null, started), false)
  })

  it("stops believing a lock the claim would already steal", () => {
    // `try_claim_conversation_turn` hands a lock this old to the next worker,
    // so past it the turn is dead and nobody is writing.
    assert.equal(isAssistantTyping(lockedAt, started + TURN_LOCK_TTL_MS + 1), false)
  })

  it("treats an unparseable timestamp as not typing", () => {
    assert.equal(isAssistantTyping("dün", started), false)
  })
})
