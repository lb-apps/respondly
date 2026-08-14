import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { inferClaimKind } from "@/lib/assistant/claim-kind"

describe("inferClaimKind", () => {
  it("files prose as informational, even when it mentions prices", () => {
    // The real regression: get_hotel_info returned a page about Kadıköy that
    // used the word "price" in passing, and every claim was logged as a price.
    const prose =
      "## Where to stay in Kadıköy\nKadıköy is the centre of Istanbul's Asian side. Rooms here are good value and the price of a ferry is trivial."
    assert.equal(inferClaimKind(prose), "policy")
  })

  it("recognises a real price payload by its fields", () => {
    assert.equal(
      inferClaimKind({ rooms: [{ name: "Suit", bestRate: { stayTotal: 5151, currency: "TRY" } }] }),
      "price"
    )
  })

  it("recognises an availability payload", () => {
    assert.equal(inferClaimKind({ slots: ["10:00", "14:00"] }), "availability")
  })

  it("falls back to policy for a payload with neither", () => {
    assert.equal(inferClaimKind({ checkIn: "14:00", petsAllowed: false }), "policy")
  })

  it("survives null and deeply nested junk", () => {
    assert.equal(inferClaimKind(null), "policy")
    assert.equal(inferClaimKind({ a: { b: { c: { d: { e: { price: 1 } } } } } }), "policy")
  })
})
