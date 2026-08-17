import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  conversationRowNeedsRefetch,
  isAssistantTyping,
  messageRowBumpsList,
  mergeThreadMessages,
  TURN_LOCK_TTL_MS,
  patchConversationFromRealtimeRow,
  sortInboxConversations,
} from "@/lib/inbox/list-utils"

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

describe("conversationRowNeedsRefetch", () => {
  const held = { status: "bot" }

  it("does not refetch for the row its own read-marker wrote", () => {
    // Opening a thread writes unread_count/last_read_at, which echoes back as
    // an UPDATE. Refetching here made every click cost a second full page load.
    assert.equal(
      conversationRowNeedsRefetch(held, {
        status: "bot",
        unread_count: 0,
        last_read_at: "2026-08-13T10:05:00Z",
      }),
      false
    )
  })

  it("does not refetch while an assistant turn takes and releases its lock", () => {
    assert.equal(
      conversationRowNeedsRefetch(held, {
        status: "bot",
        turn_locked_at: "2026-08-13T10:05:00Z",
      }),
      false
    )
    assert.equal(
      conversationRowNeedsRefetch(held, { status: "bot", turn_locked_at: null }),
      false
    )
  })

  it("does not refetch for a new message's preview and timestamp", () => {
    assert.equal(
      conversationRowNeedsRefetch(held, {
        status: "bot",
        last_message_at: "2026-08-13T10:05:00Z",
        last_message_preview: "Teşekkürler",
      }),
      false
    )
  })

  it("refetches when the thread changes hands", () => {
    assert.equal(
      conversationRowNeedsRefetch(held, { status: "needs_human" }),
      true
    )
    assert.equal(
      conversationRowNeedsRefetch({ status: "human" }, { status: "closed" }),
      true
    )
  })

  it("ignores a push-name change, which arrives on the contacts channel", () => {
    assert.equal(
      conversationRowNeedsRefetch(held, { status: "bot", guest_name: "emirhan" }),
      false
    )
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

describe("messageRowBumpsList", () => {
  it("keeps a timeline event out of the list", () => {
    // The trigger already refuses to move `last_message_at` for a system row.
    // Without this the list would still bump optimistically and then snap back
    // when the refresh landed.
    assert.equal(messageRowBumpsList({ role: "system" }), false)
  })

  it("lets every real message through", () => {
    assert.equal(messageRowBumpsList({ role: "guest" }), true)
    assert.equal(messageRowBumpsList({ role: "assistant" }), true)
    assert.equal(messageRowBumpsList({ role: "staff" }), true)
  })

  it("fails open on a role it cannot read", () => {
    // A row we cannot classify is a message. The other way round hides traffic.
    assert.equal(messageRowBumpsList({}), true)
    assert.equal(messageRowBumpsList({ role: null }), true)
  })
})
