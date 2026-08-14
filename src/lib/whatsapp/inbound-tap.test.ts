import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { interactiveReply, tapText } from "@/lib/whatsapp/inbound-tap"
import { encodeCardTap } from "@/lib/whatsapp/carousel-message"

describe("interactiveReply", () => {
  it("reads a carousel card tap, which arrives as a button message", () => {
    // The shape that was being dropped: `payload` carries our id, and reading
    // only `text` left the assistant with "Detaylar" and no card.
    const reply = interactiveReply({
      type: "button",
      button: {
        text: "Detaylar",
        payload: encodeCardTap("Standart Çift Kişilik", "Detaylar"),
      },
    })
    assert.equal(reply?.title, "Detaylar")
    assert.equal(tapText(reply!), "Standart Çift Kişilik — Detaylar")
  })

  it("reads a reply button", () => {
    const reply = interactiveReply({
      type: "interactive",
      interactive: { button_reply: { id: "opt_1", title: "Evet" } },
    })
    assert.deepEqual(reply, { id: "opt_1", title: "Evet" })
  })

  it("reads a list row", () => {
    const reply = interactiveReply({
      type: "interactive",
      interactive: { list_reply: { id: "opt_2", title: "Suit" } },
    })
    assert.deepEqual(reply, { id: "opt_2", title: "Suit" })
  })

  it("is null for a message that tapped nothing", () => {
    assert.equal(interactiveReply({ type: "text" }), null)
    assert.equal(interactiveReply({ type: "image" }), null)
    assert.equal(interactiveReply({ type: "button" }), null)
  })
})

describe("tapText", () => {
  it("gives up on an id it did not mint, leaving the label to the caller", () => {
    assert.equal(tapText({ id: "card_0_1", title: "Seç" }), null)
    assert.equal(tapText({ title: "Seç" }), null)
  })
})
