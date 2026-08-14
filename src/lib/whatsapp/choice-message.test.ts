import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  CHOICE_BUTTON_LIMIT,
  choiceTransport,
  toChoiceMessage,
} from "@/lib/whatsapp/choice-message"

function options(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `opt_${index}`,
    label: `Seçenek ${index + 1}`,
  }))
}

describe("toChoiceMessage", () => {
  it("reads a well-formed ask_choice result", () => {
    const choice = toChoiceMessage({
      queued: true,
      body: "Kaç kişisiniz?",
      options: [
        { id: "opt_0", label: "1 kişi" },
        { id: "opt_1", label: "2 kişi" },
      ],
      footer: "Daha fazlası için yazabilirsiniz",
    })
    assert.equal(choice?.body, "Kaç kişisiniz?")
    assert.equal(choice?.options.length, 2)
    assert.equal(choice?.footer, "Daha fazlası için yazabilirsiniz")
  })

  it("keeps description and group when present", () => {
    const choice = toChoiceMessage({
      body: "Uyruğunuz?",
      options: [
        { id: "opt_0", label: "Türkiye", group: "Avrupa", description: "TR" },
      ],
    })
    assert.equal(choice?.options[0].group, "Avrupa")
    assert.equal(choice?.options[0].description, "TR")
  })

  it("backfills a missing option id", () => {
    const choice = toChoiceMessage({
      body: "Seçin",
      options: [{ label: "A" }, { label: "B" }],
    })
    assert.deepEqual(
      choice?.options.map((o) => o.id),
      ["opt_0", "opt_1"]
    )
  })

  it("drops options with no label", () => {
    const choice = toChoiceMessage({
      body: "Seçin",
      options: [{ label: "A" }, { label: "   " }, { note: "junk" }],
    })
    assert.equal(choice?.options.length, 1)
  })

  it("caps at WhatsApp's ten-row ceiling", () => {
    const choice = toChoiceMessage({
      body: "Seçin",
      options: Array.from({ length: 25 }, (_, i) => ({ label: `X${i}` })),
    })
    assert.equal(choice?.options.length, 10)
  })

  it("returns null without a body or without options", () => {
    assert.equal(toChoiceMessage({ options: [{ label: "A" }] }), null)
    assert.equal(toChoiceMessage({ body: "Soru", options: [] }), null)
    assert.equal(toChoiceMessage(null), null)
  })
})

describe("choiceTransport", () => {
  it("uses buttons up to the button limit", () => {
    assert.equal(choiceTransport(options(2)), "buttons")
    assert.equal(choiceTransport(options(CHOICE_BUTTON_LIMIT)), "buttons")
  })

  it("keeps two priced options as a list, because buttons show no description", () => {
    // Two rooms that differ only by price: as buttons the prices would vanish.
    const priced = [
      { id: "opt_0", label: "Standart Çift", description: "36.069 TL" },
      { id: "opt_1", label: "Aile Odası", description: "44.922 TL" },
    ]
    assert.equal(choiceTransport(priced), "buttons")
    assert.equal(choiceTransport(priced, true), "list")
  })

  it("ignores the flag when no option actually has a description", () => {
    assert.equal(choiceTransport(options(2), true), "buttons")
  })

  it("switches to a list beyond it", () => {
    assert.equal(choiceTransport(options(CHOICE_BUTTON_LIMIT + 1)), "list")
    assert.equal(choiceTransport(options(10)), "list")
  })
})
