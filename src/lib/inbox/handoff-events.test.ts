import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  handoffEventText,
  parseHandoffEvent,
} from "@/lib/inbox/handoff-events"

describe("handoffEventText", () => {
  it("names the assistant as the one who let go", () => {
    assert.equal(
      handoffEventText("handoff_to_human"),
      "Asistan konuşmayı ekibe devretti"
    )
  })

  it("names the teammate who took over", () => {
    assert.equal(handoffEventText("takeover", "Ayşe Demir"), "Ayşe Demir konuşmayı devraldı")
  })

  it("falls back to the team when the person is unknown", () => {
    assert.equal(handoffEventText("takeover", null), "Konuşma ekip tarafından devralındı")
    assert.equal(
      handoffEventText("returned_to_assistant"),
      "Konuşma asistana geri verildi"
    )
  })

  it("treats a blank name as no name — never leaves a gap in the sentence", () => {
    assert.equal(handoffEventText("takeover", "   "), "Konuşma ekip tarafından devralındı")
  })

  it("names the teammate who handed it back", () => {
    assert.equal(
      handoffEventText("returned_to_assistant", "Ayşe"),
      "Ayşe konuşmayı asistana geri verdi"
    )
  })
})

describe("parseHandoffEvent", () => {
  it("reads a stored event", () => {
    assert.deepEqual(
      parseHandoffEvent({ event: { kind: "handoff_to_human", reason: "turn_failed" } }),
      { kind: "handoff_to_human", reason: "turn_failed" }
    )
  })

  it("keeps the kind when the reason is missing", () => {
    assert.deepEqual(parseHandoffEvent({ event: { kind: "takeover" } }), {
      kind: "takeover",
    })
  })

  it("drops a reason it does not know, keeping the kind", () => {
    assert.deepEqual(
      parseHandoffEvent({ event: { kind: "takeover", reason: "spilled_coffee" } }),
      { kind: "takeover" }
    )
  })

  it("is null for an unknown kind — an unreadable row draws nothing", () => {
    assert.equal(parseHandoffEvent({ event: { kind: "escalated_to_ceo" } }), null)
  })

  it("is null for metadata that carries no event at all", () => {
    assert.equal(parseHandoffEvent(null), null)
    assert.equal(parseHandoffEvent({}), null)
    assert.equal(parseHandoffEvent({ attachments: [] }), null)
    assert.equal(parseHandoffEvent({ event: "takeover" }), null)
    assert.equal(parseHandoffEvent({ event: { kind: 3 } }), null)
    assert.equal(parseHandoffEvent("takeover"), null)
  })
})
