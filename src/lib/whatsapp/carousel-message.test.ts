import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  cardName,
  carouselButtons,
  decodeCardTap,
  encodeCardTap,
  tapTextFromRichContent,
  toCarouselMessage,
} from "@/lib/whatsapp/carousel-message"

const card = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `card_${n}`,
  imageUrl: `https://cdn.example.com/${n}.jpg`,
  body: `*Oda ${n}* · 2 Kişi · 18 m²\n3 gece 18.549 TL`,
  buttons: [{ label: "Detaylar" }, { label: "Seç" }],
  ...extra,
})

describe("toCarouselMessage", () => {
  it("reads a well-formed show_carousel result", () => {
    const message = toCarouselMessage({
      queued: true,
      body: "İki odamız uygun:",
      cards: [card(0), card(1)],
    })
    assert.equal(message?.type, "carousel")
    assert.equal(message?.cards.length, 2)
    assert.deepEqual(
      message?.cards[0].buttons.map((b) => b.label),
      ["Detaylar", "Seç"]
    )
  })

  it("refuses a single card — Meta's floor is two", () => {
    assert.equal(toCarouselMessage({ body: "Tek oda", cards: [card(0)] }), null)
  })

  it("drops a card with no picture, then the carousel with it", () => {
    assert.equal(
      toCarouselMessage({
        body: "Odalar",
        cards: [card(0), { ...card(1), imageUrl: "" }],
      }),
      null
    )
  })

  it("drops a card with nothing to tap", () => {
    assert.equal(
      toCarouselMessage({
        body: "Odalar",
        cards: [card(0), { ...card(1), buttons: [] }],
      }),
      null
    )
  })

  it("ignores a result with no body", () => {
    assert.equal(
      toCarouselMessage({ body: "   ", cards: [card(0), card(1)] }),
      null
    )
  })

  it("caps the cards at Meta's ten", () => {
    const message = toCarouselMessage({
      body: "Odalar",
      cards: Array.from({ length: 15 }, (_, i) => card(i)),
    })
    assert.equal(message?.cards.length, 10)
  })

  it("caps the buttons at two per card", () => {
    const message = toCarouselMessage({
      body: "Odalar",
      cards: [
        {
          ...card(0),
          buttons: [{ label: "A" }, { label: "B" }, { label: "C" }],
        },
        card(1),
      ],
    })
    assert.equal(message?.cards[0].buttons.length, 2)
  })

  it("survives junk", () => {
    assert.equal(toCarouselMessage(null), null)
    assert.equal(toCarouselMessage({ body: "Odalar", cards: "nope" }), null)
  })
})

describe("cardName", () => {
  it("takes the name from the start of the body", () => {
    assert.equal(
      cardName("*Standart Çift Kişilik* · 2 Kişi · 18 m²\n3 gece 18.549 TL", "x"),
      "Standart Çift Kişilik"
    )
  })

  it("falls back when there is no body to read", () => {
    assert.equal(cardName(undefined, "Seçenek 1"), "Seçenek 1")
    assert.equal(cardName("   ", "Seçenek 2"), "Seçenek 2")
  })
})

describe("card taps", () => {
  it("round-trips the card name and the button", () => {
    const id = encodeCardTap("Suit", "Detaylar")
    assert.deepEqual(decodeCardTap(id), { name: "Suit", label: "Detaylar" })
  })

  it("ignores ids we did not mint", () => {
    assert.equal(decodeCardTap("opt_0"), null)
    assert.equal(decodeCardTap(undefined), null)
    assert.equal(decodeCardTap("card:onlyname"), null)
  })
})

describe("tapTextFromRichContent", () => {
  const carousel = {
    type: "carousel",
    body: "Odalar",
    cards: [
      {
        id: "card_0",
        body: "*Standart Çift Kişilik*\n2 Misafir · 14 m²",
        buttons: [{ label: "Detaylar" }, { label: "Seç" }],
      },
      {
        id: "card_1",
        body: "*Suit*\n3 Misafir · 24 m²",
        buttons: [{ label: "Detaylar" }, { label: "Seç" }],
      },
    ],
  }

  it("names the card behind a built-in id", () => {
    assert.equal(
      tapTextFromRichContent([carousel], { id: "card_1_0", title: "Detaylar" }),
      "Suit — Detaylar"
    )
  })

  it("tells the two buttons of one card apart", () => {
    assert.equal(
      tapTextFromRichContent([carousel], { id: "card_1_1", title: "Seç" }),
      "Suit — Seç"
    )
  })

  it("reads an id this version minted", () => {
    const minted = {
      ...carousel,
      cards: [
        {
          ...carousel.cards[0],
          buttons: [{ label: "Seç", id: encodeCardTap("Standart", "Seç") }],
        },
        carousel.cards[1],
      ],
    }
    assert.equal(
      tapTextFromRichContent([minted], {
        id: encodeCardTap("Standart", "Seç"),
        title: "Seç",
      }),
      "Standart Çift Kişilik — Seç"
    )
  })

  it("resolves a list row back to its option label", () => {
    const choice = {
      type: "choice",
      body: "Hangi oda?",
      options: [
        { id: "opt_0", label: "Standart" },
        { id: "opt_1", label: "Suit" },
      ],
    }
    assert.equal(
      tapTextFromRichContent([choice], { id: "opt_1", title: "Suit" }),
      "Suit"
    )
  })

  it("gives up rather than guessing", () => {
    assert.equal(tapTextFromRichContent([carousel], { id: "card_9_0" }), null)
    assert.equal(tapTextFromRichContent(null, { id: "card_0_0" }), null)
    assert.equal(tapTextFromRichContent([carousel], {}), null)
  })
})

describe("carouselButtons", () => {
  it("links out when every card has exactly one url button", () => {
    const cards = [
      { imageUrl: "a", buttons: [{ label: "Seç", url: "https://a" }] },
      { imageUrl: "b", buttons: [{ label: "Seç", url: "https://b" }] },
    ]
    assert.equal(carouselButtons(cards), "links")
  })

  it("degrades to replies as soon as one card has none", () => {
    const cards = [
      { imageUrl: "a", buttons: [{ label: "Seç", url: "https://a" }] },
      { imageUrl: "b", buttons: [{ label: "Seç" }] },
    ]
    assert.equal(carouselButtons(cards), "replies")
  })

  it("treats a two-button card as replies — a link cannot share a card", () => {
    const cards = [
      {
        imageUrl: "a",
        buttons: [{ label: "Detaylar", url: "https://a" }, { label: "Seç" }],
      },
      {
        imageUrl: "b",
        buttons: [{ label: "Detaylar", url: "https://b" }, { label: "Seç" }],
      },
    ]
    assert.equal(carouselButtons(cards), "replies")
  })
})
