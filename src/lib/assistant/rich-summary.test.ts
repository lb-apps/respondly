import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { summarizeRichContent } from "@/lib/assistant/rich-summary"

describe("summarizeRichContent", () => {
  it("says nothing for a plain text message", () => {
    assert.equal(summarizeRichContent(null), null)
    assert.equal(summarizeRichContent([]), null)
    assert.equal(summarizeRichContent("carousel"), null)
  })

  it("counts photos, which carry no words of their own", () => {
    assert.equal(
      summarizeRichContent([{ type: "image", imageUrl: "a" }]),
      "[you sent a photo here]"
    )
    assert.equal(
      summarizeRichContent([
        { type: "image", imageUrl: "a" },
        { type: "image", imageUrl: "b" },
        { type: "image", imageUrl: "c" },
      ]),
      "[you sent 3 photos here]"
    )
  })

  it("names the cards of a carousel", () => {
    assert.equal(
      summarizeRichContent([
        {
          type: "carousel",
          cards: [
            { body: "Standart Çift Kişilik" },
            { body: "Aile Odası" },
          ],
        },
      ]),
      "[you sent a carousel (Standart Çift Kişilik, Aile Odası) here]"
    )
  })

  it("keeps a long set short — a summary, not a second copy", () => {
    const summary = summarizeRichContent([
      {
        type: "choice",
        options: [
          { label: "Standart Çift Kişilik Oda, deniz manzaralı, balkonlu" },
          { label: "Aile Odası" },
          { label: "Suit" },
          { label: "Deluxe" },
          { label: "Bahçe Katı" },
        ],
      },
    ])
    assert.equal(
      summary,
      "[you sent an option list (Standart Çift Kişilik Oda, deni…, Aile Odası, Suit, +2 more) here]"
    )
  })

  it("names a link button by its label", () => {
    assert.equal(
      summarizeRichContent([
        { type: "cta", buttonLabel: "Rezervasyonu Tamamla", url: "https://x" },
      ]),
      '[you sent a link button ("Rezervasyonu Tamamla") here]'
    )
  })

  it("covers the pin and the location request", () => {
    assert.equal(
      summarizeRichContent([{ type: "location", latitude: "1", longitude: "2" }]),
      "[you sent a map pin here]"
    )
    assert.equal(
      summarizeRichContent([{ type: "location_request", body: "Neredesiniz?" }]),
      "[you sent a request for the customer's location here]"
    )
  })

  it("joins what one turn sent together", () => {
    assert.equal(
      summarizeRichContent([
        { type: "image", imageUrl: "a" },
        { type: "image", imageUrl: "b" },
        { type: "cta", buttonLabel: "Rezervasyon", url: "https://x" },
      ]),
      '[you sent 2 photos and a link button ("Rezervasyon") here]'
    )
  })

  it("ignores a shape it does not recognise rather than describing it wrongly", () => {
    assert.equal(summarizeRichContent([{ type: "hologram" }]), null)
    assert.equal(summarizeRichContent([{ notAType: 1 }]), null)
  })

  it("still names a carousel whose cards carry no text", () => {
    assert.equal(
      summarizeRichContent([{ type: "carousel", cards: [{ imageUrl: "a" }] }]),
      "[you sent a carousel here]"
    )
  })
})

describe("summarizeRichContent — carousel cards", () => {
  it("names a card by its first line, not its whole block", () => {
    assert.equal(
      summarizeRichContent([
        {
          type: "carousel",
          cards: [
            { body: "Suit\n3 Misafir · 24 m²\n*23.204 TL* Spa banyosu ve ayrı yatak odası." },
          ],
        },
      ]),
      "[you sent a carousel (Suit) here]"
    )
  })
})
