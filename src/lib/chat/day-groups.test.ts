import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { dayKey, formatDayHeading, groupByDay } from "@/lib/chat/day-groups"

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
