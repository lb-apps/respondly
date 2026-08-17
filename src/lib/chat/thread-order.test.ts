import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { orderTurnEvents } from "@/lib/chat/thread-order"
import type { ThreadRow } from "@/components/chat/thread-view"
import type { ThreadEvent } from "@/lib/inbox/thread-events"

const CARD_UPDATED: ThreadEvent = {
  kind: "contact_profile_updated",
  changes: [{ field: "last_name", from: "Yıldırım", to: "Demir" }],
}

function guest(id: string, at: string): ThreadRow {
  return {
    kind: "message",
    id,
    createdAt: at,
    side: "start",
    author: { kind: "contact", avatarSeed: "+905551112233" },
    text: "…",
  }
}

function assistant(id: string, at: string): ThreadRow {
  return {
    kind: "message",
    id,
    createdAt: at,
    side: "end",
    author: { kind: "assistant" },
    text: "…",
  }
}

function event(id: string, at: string, sender: { name: string | null; avatarUrl: string | null } | null = null): ThreadRow {
  return { kind: "event", id, createdAt: at, event: CARD_UPDATED, sender }
}

const ids = (rows: ThreadRow[]) => rows.map((r) => r.id)

describe("orderTurnEvents", () => {
  it("reports what the assistant learned after what it said", () => {
    // As the timestamps come out of the database: the tool ran mid-turn, so the
    // event is stamped before the reply that was saved once the turn finished.
    const rows = [
      guest("q", "2026-08-17T22:47:00Z"),
      event("e", "2026-08-17T22:47:20Z"),
      assistant("a", "2026-08-17T22:47:30Z"),
    ]
    assert.deepEqual(ids(orderTurnEvents(rows)), ["q", "a", "e"])
  })

  it("clears every reply the turn sent, not just the first", () => {
    const rows = [
      guest("q", "t0"),
      event("e", "t1"),
      assistant("a1", "t2"),
      assistant("a2", "t3"),
    ]
    assert.deepEqual(ids(orderTurnEvents(rows)), ["q", "a1", "a2", "e"])
  })

  it("leaves a teammate's own edit where its timestamp puts it", () => {
    const rows = [
      guest("q", "t0"),
      event("e", "t1", { name: "Emirhan", avatarUrl: null }),
      assistant("a", "t2"),
    ]
    assert.deepEqual(ids(orderTurnEvents(rows)), ["q", "e", "a"])
  })

  it("stops at the next customer message rather than sliding to the end", () => {
    const rows = [
      guest("q1", "t0"),
      event("e", "t1"),
      assistant("a", "t2"),
      guest("q2", "t3"),
    ]
    assert.deepEqual(ids(orderTurnEvents(rows)), ["q1", "a", "e", "q2"])
  })

  it("handles two turns that each learned something", () => {
    const rows = [
      guest("q1", "t0"),
      event("e1", "t1"),
      assistant("a1", "t2"),
      guest("q2", "t3"),
      event("e2", "t4"),
      assistant("a2", "t5"),
    ]
    assert.deepEqual(ids(orderTurnEvents(rows)), ["q1", "a1", "e1", "q2", "a2", "e2"])
  })

  it("leaves an event with no reply after it alone", () => {
    const rows = [guest("q", "t0"), assistant("a", "t1"), event("e", "t2")]
    assert.deepEqual(ids(orderTurnEvents(rows)), ["q", "a", "e"])
  })

  it("does not mutate the array it was given", () => {
    const rows = [guest("q", "t0"), event("e", "t1"), assistant("a", "t2")]
    orderTurnEvents(rows)
    assert.deepEqual(ids(rows), ["q", "e", "a"])
  })
})
