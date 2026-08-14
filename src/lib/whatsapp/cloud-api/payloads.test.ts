import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildCarouselPayload,
  buildCtaUrlPayload,
  buildImagePayload,
  buildListPayload,
  buildLocationPayload,
  buildLocationRequestPayload,
  buildReplyButtonsPayload,
  buildTextPayload,
} from "@/lib/whatsapp/cloud-api/payloads"

const TO = "+905551112233"

describe("buildCtaUrlPayload header", () => {
  const URL = "https://mydorahotel.com/checkout/abc"

  it("puts a picture above the body when one is supplied", () => {
    const payload = buildCtaUrlPayload(TO, "Onaylayın", "Tamamla", URL, {
      headerImage: { id: "1234567890" },
    })
    assert.deepEqual(payload.interactive.header, {
      type: "image",
      image: { id: "1234567890" },
    })
  })

  it("accepts a link when we have no uploaded media", () => {
    const payload = buildCtaUrlPayload(TO, "Onaylayın", "Tamamla", URL, {
      headerImage: { link: "https://cdn.example.com/room.jpg" },
    })
    assert.deepEqual(payload.interactive.header, {
      type: "image",
      image: { link: "https://cdn.example.com/room.jpg" },
    })
  })

  it("lets the picture win over a text header — Meta allows only one", () => {
    const payload = buildCtaUrlPayload(TO, "Onaylayın", "Tamamla", URL, {
      headerText: "Rezervasyon",
      headerImage: { id: "42" },
    })
    assert.equal(payload.interactive.header?.type, "image")
  })

  it("keeps the text header when there is no picture", () => {
    const payload = buildCtaUrlPayload(TO, "Onaylayın", "Tamamla", URL, {
      headerText: "Rezervasyon",
    })
    assert.deepEqual(payload.interactive.header, {
      type: "text",
      text: "Rezervasyon",
    })
  })

  it("omits the header entirely when neither is given", () => {
    const payload = buildCtaUrlPayload(TO, "Onaylayın", "Tamamla", URL)
    assert.equal("header" in payload.interactive, false)
  })
})

describe("interactive chrome is plain text", () => {
  it("strips formatting marks from list rows, which render them literally", () => {
    // The pricing rules teach the model to emphasise a discount. In a row that
    // emphasis would arrive as visible asterisks and tildes.
    const payload = buildListPayload(
      TO,
      "Hangisi?",
      "Seçenekler",
      [
        {
          id: "opt_0",
          label: "*Suit*",
          description: "7 gece *51.855 TL* ~61.005 TL~",
        },
      ],
      { footerText: "~Kahvaltı dahil~" }
    )
    const row = payload.interactive.action.sections[0].rows[0]
    assert.equal(row.title, "Suit")
    assert.equal(row.description, "7 gece 51.855 TL 61.005 TL")
    assert.equal(payload.interactive.footer?.text, "Kahvaltı dahil")
  })

  it("leaves the body alone, where WhatsApp does render formatting", () => {
    const payload = buildListPayload(TO, "Fiyat *3.750 TRY*", "Seç", [
      { id: "opt_0", label: "Evet" },
    ])
    assert.equal(payload.interactive.body.text, "Fiyat *3.750 TRY*")
  })

  it("strips marks from reply button titles too", () => {
    const payload = buildReplyButtonsPayload(TO, "Onaylıyor musunuz?", [
      { id: "opt_0", label: "_Evet_" },
    ])
    assert.equal(
      payload.interactive.action.buttons[0].reply.title,
      "Evet"
    )
  })
})

describe("limits the docs state but the code used to ignore", () => {
  it("clamps a text message to 4096 characters", () => {
    const payload = buildTextPayload(TO, "a".repeat(5000))
    assert.equal(payload.text.body.length, 4096)
  })

  it("keeps reply-button labels unique, as Meta demands", () => {
    // Two different room names that collide once cut to 20 characters. Sent as
    // written, Meta rejects the whole message.
    const payload = buildReplyButtonsPayload(TO, "Hangisi?", [
      { id: "opt_0", label: "Standart Çift Kişilik Oda" },
      { id: "opt_1", label: "Standart Çift Kişilik Suit" },
    ])
    const titles = payload.interactive.action.buttons.map((b) => b.reply.title)
    assert.equal(new Set(titles).size, titles.length)
    assert.ok(titles.every((t) => t.length <= 20))
  })

  it("keeps two buttons on one carousel card distinct", () => {
    const card = {
      imageUrl: "https://cdn.example.com/a.jpg",
      body: "*Oda*",
      buttons: [{ label: "Seç" }, { label: "Seç" }],
    }
    const payload = buildCarouselPayload(TO, "Odalar", [card, { ...card }])
    const titles = payload.interactive.action.cards[0].action.buttons?.map(
      (b) => b.quick_reply.title
    )
    assert.deepEqual(titles, ["Seç", "Seç 2"])
  })
})

describe("buildListPayload section titles", () => {
  const grouped = [
    { id: "a", label: "Sabah", group: "Hafta içi" },
    { id: "b", label: "Öğlen", group: "" },
  ]

  it("names an unlabelled group in the customer's language, not ours", () => {
    const payload = buildListPayload(TO, "Ne zaman?", "Choose", grouped, {
      sectionTitleFallback: "Options",
    })
    const titles = payload.interactive.action.sections.map((s) => s.title)
    assert.deepEqual(titles, ["Hafta içi", "Options"])
  })

  it("falls back to the button label when no fallback was supplied", () => {
    const payload = buildListPayload(TO, "Ne zaman?", "Optionen", grouped)
    const titles = payload.interactive.action.sections.map((s) => s.title)
    assert.deepEqual(titles, ["Hafta içi", "Optionen"])
  })

  it("titles a single unnamed group too — the docs call the title required", () => {
    const payload = buildListPayload(
      TO,
      "Ne zaman?",
      "Seçenekler",
      [{ id: "a", label: "Sabah" }],
      { sectionTitleFallback: "Options" }
    )
    assert.equal(payload.interactive.action.sections[0].title, "Options")
  })
})

describe("buildImagePayload", () => {
  it("sends by media id when we already uploaded the picture", () => {
    assert.deepEqual(buildImagePayload(TO, { id: "1234567890" }, "Deluxe Oda"), {
      to: TO,
      type: "image",
      image: { id: "1234567890", caption: "Deluxe Oda" },
    })
  })

  it("falls back to a link Meta downloads itself", () => {
    assert.deepEqual(
      buildImagePayload(TO, { link: "https://cdn.example.com/room.jpg" }, ""),
      {
        to: TO,
        type: "image",
        image: { link: "https://cdn.example.com/room.jpg" },
      }
    )
  })

  it("drops a caption that is only whitespace", () => {
    assert.deepEqual(buildImagePayload(TO, { id: "42" }, "   "), {
      to: TO,
      type: "image",
      image: { id: "42" },
    })
  })
})

describe("buildReplyButtonsPayload", () => {
  it("builds an interactive button message", () => {
    const payload = buildReplyButtonsPayload(TO, "Kaç kişi?", [
      { id: "opt_0", label: "1 kişi" },
      { id: "opt_1", label: "2 kişi" },
    ])
    assert.deepEqual(payload, {
      to: TO,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Kaç kişi?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "opt_0", title: "1 kişi" } },
            { type: "reply", reply: { id: "opt_1", title: "2 kişi" } },
          ],
        },
      },
    })
  })

  it("truncates button titles to Meta's 20-char limit", () => {
    const payload = buildReplyButtonsPayload(TO, "Soru", [
      { id: "opt_0", label: "Bu etiket kesinlikle fazlasıyla uzun" },
    ])
    const title =
      payload.interactive.action.buttons[0].reply.title
    assert.equal(title.length, 20)
  })

  it("never sends more than three buttons", () => {
    const payload = buildReplyButtonsPayload(
      TO,
      "Soru",
      Array.from({ length: 7 }, (_, i) => ({ id: `opt_${i}`, label: `S${i}` }))
    )
    assert.equal(payload.interactive.action.buttons.length, 3)
  })

  it("adds header and footer only when provided", () => {
    const bare = buildReplyButtonsPayload(TO, "Soru", [
      { id: "opt_0", label: "Evet" },
    ])
    assert.ok(!("header" in bare.interactive))
    assert.ok(!("footer" in bare.interactive))

    const dressed = buildReplyButtonsPayload(
      TO,
      "Soru",
      [{ id: "opt_0", label: "Evet" }],
      { headerText: "Rezervasyon", footerText: "Sonra değiştirebilirsiniz" }
    )
    assert.deepEqual(dressed.interactive.header, {
      type: "text",
      text: "Rezervasyon",
    })
    assert.deepEqual(dressed.interactive.footer, {
      text: "Sonra değiştirebilirsiniz",
    })
  })
})

describe("buildListPayload", () => {
  it("puts ungrouped options in a single section, titled — Meta requires it", () => {
    const payload = buildListPayload(TO, "Uyruğunuz?", "Seçin", [
      { id: "opt_0", label: "Türkiye" },
      { id: "opt_1", label: "Almanya" },
      { id: "opt_2", label: "Rusya" },
      { id: "opt_3", label: "Diğer" },
    ])
    assert.equal(payload.interactive.type, "list")
    assert.equal(payload.interactive.action.sections.length, 1)
    assert.equal(payload.interactive.action.sections[0].title, "Seçin")
    assert.equal(payload.interactive.action.sections[0].rows.length, 4)
  })

  it("splits grouped options into titled sections", () => {
    const payload = buildListPayload(TO, "Uyruğunuz?", "Seçin", [
      { id: "opt_0", label: "Türkiye", group: "Sık seçilen" },
      { id: "opt_1", label: "Almanya", group: "Avrupa" },
      { id: "opt_2", label: "Rusya", group: "Avrupa" },
    ])
    const sections = payload.interactive.action.sections
    assert.equal(sections.length, 2)
    assert.equal(sections[0].title, "Sık seçilen")
    assert.equal(sections[1].title, "Avrupa")
    assert.equal(sections[1].rows.length, 2)
  })

  it("keeps a row description when given", () => {
    const payload = buildListPayload(TO, "Oda tipi?", "Seçin", [
      { id: "opt_0", label: "Suit", description: "Deniz manzaralı" },
      { id: "opt_1", label: "Standart" },
      { id: "opt_2", label: "Aile" },
      { id: "opt_3", label: "Diğer" },
    ])
    const rows = payload.interactive.action.sections[0].rows
    assert.equal(rows[0].description, "Deniz manzaralı")
    assert.ok(!("description" in rows[1]))
  })

  it("clamps row titles, descriptions and the open button", () => {
    const payload = buildListPayload(
      TO,
      "Soru",
      "Bu buton etiketi fazlasıyla uzun",
      [
        {
          id: "opt_0",
          label: "Bu satır başlığı yirmi dört karakterden uzun",
          description: "x".repeat(120),
        },
      ]
    )
    const row = payload.interactive.action.sections[0].rows[0]
    assert.equal(row.title.length, 24)
    assert.equal(row.description?.length, 72)
    assert.equal(payload.interactive.action.button.length, 20)
  })

  it("never sends more than ten rows", () => {
    const payload = buildListPayload(
      TO,
      "Soru",
      "Seçin",
      Array.from({ length: 30 }, (_, i) => ({ id: `opt_${i}`, label: `S${i}` }))
    )
    const rows = payload.interactive.action.sections.flatMap((s) => s.rows)
    assert.equal(rows.length, 10)
  })
})

describe("buildLocationRequestPayload", () => {
  it("asks for a location", () => {
    assert.deepEqual(buildLocationRequestPayload(TO, "Neredesiniz?"), {
      to: TO,
      type: "interactive",
      interactive: {
        type: "location_request_message",
        body: { text: "Neredesiniz?" },
        action: { name: "send_location" },
      },
    })
  })
})

describe("buildCarouselPayload", () => {
  const cards = [
    {
      imageUrl: "https://cdn.example.com/deluxe.jpg",
      body: "*Deluxe Oda*\n3.750 TL / gece",
      buttons: [
        {
          label: "Rezervasyon Yap",
          url: "https://book.example.com/deluxe",
        },
      ],
    },
    {
      imageUrl: "https://cdn.example.com/suit.jpg",
      body: "*Suit*\n5.100 TL / gece",
      buttons: [
        { label: "Rezervasyon Yap", url: "https://book.example.com/suit" },
      ],
    },
  ]

  it("builds the card shape Meta documents", () => {
    const payload = buildCarouselPayload(TO, "İki odamız uygun:", cards)
    assert.equal(payload.interactive.type, "carousel")
    assert.deepEqual(payload.interactive.body, { text: "İki odamız uygun:" })
    assert.deepEqual(payload.interactive.action.cards[0], {
      card_index: 0,
      type: "cta_url",
      header: {
        type: "image",
        image: { link: "https://cdn.example.com/deluxe.jpg" },
      },
      body: { text: "*Deluxe Oda*\n3.750 TL / gece" },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "Rezervasyon Yap",
          url: "https://book.example.com/deluxe",
        },
      },
    })
    assert.equal(payload.interactive.action.cards[1].card_index, 1)
  })

  it("carries no header, footer or other chrome — Meta supports none", () => {
    const payload = buildCarouselPayload(TO, "Odalar", cards)
    assert.equal("header" in payload.interactive, false)
    assert.equal("footer" in payload.interactive, false)
  })

  it("leaves emphasis in card bodies, which render it", () => {
    const payload = buildCarouselPayload(TO, "Odalar", cards)
    assert.equal(
      payload.interactive.action.cards[0].body?.text,
      "*Deluxe Oda*\n3.750 TL / gece"
    )
  })

  it("strips emphasis from button labels, which do not", () => {
    const payload = buildCarouselPayload(TO, "Odalar", [
      { ...cards[0], buttons: [{ ...cards[0].buttons[0], label: "*Seç*" }] },
      { ...cards[1], buttons: [{ ...cards[1].buttons[0], label: "*Seç*" }] },
    ])
    assert.equal(
      payload.interactive.action.cards[0].action.parameters?.display_text,
      "Seç"
    )
  })

  it("gives every card the same two reply buttons", () => {
    const twoButtons = cards.map((card) => ({
      ...card,
      buttons: [
        { label: "Detaylar", id: `card:${card.body.slice(1, 5)}|Detaylar` },
        { label: "Seç", id: `card:${card.body.slice(1, 5)}|Seç` },
      ],
    }))
    const payload = buildCarouselPayload(TO, "Odalar", twoButtons)
    for (const card of payload.interactive.action.cards) {
      assert.equal(card.action.buttons?.length, 2)
      assert.equal(card.action.buttons?.[0].type, "quick_reply")
      assert.equal(card.action.name, undefined)
    }
    // The id, not the shared label, is what says which card was tapped.
    assert.equal(
      payload.interactive.action.cards[0].action.buttons?.[0].quick_reply.id,
      "card:Delu|Detaylar"
    )
  })

  it("levels an uneven set down — Meta demands the same count on every card", () => {
    const payload = buildCarouselPayload(TO, "Odalar", [
      { ...cards[0], buttons: [{ label: "Detaylar" }, { label: "Seç" }] },
      { ...cards[1], buttons: [{ label: "Seç" }] },
    ])
    const counts = payload.interactive.action.cards.map(
      (card) => card.action.buttons?.length
    )
    assert.deepEqual(counts, [1, 1])
  })

  it("falls back to quick replies when a card has no link", () => {
    const payload = buildCarouselPayload(TO, "Odalar", [
      cards[0],
      { ...cards[1], buttons: [{ label: "Rezervasyon Yap" }] },
    ])
    const [first, second] = payload.interactive.action.cards
    assert.deepEqual(first.action.buttons, [
      {
        type: "quick_reply",
        quick_reply: { id: "card_0_0", title: "Rezervasyon Yap" },
      },
    ])
    assert.equal(second.action.buttons?.[0].quick_reply.id, "card_1_0")
    // Mixed button types are what Meta rejects; the link goes, not the message.
    assert.equal(first.action.name, undefined)
  })

  it("keeps a card body inside 160 characters and two line breaks", () => {
    const payload = buildCarouselPayload(TO, "Odalar", [
      { ...cards[0], body: `a\nb\nc\nd\n${"x ".repeat(200)}` },
      cards[1],
    ])
    const text = payload.interactive.action.cards[0].body?.text ?? ""
    assert.ok(text.length <= 160, `got ${text.length}`)
    assert.equal(text.split("\n").length - 1, 2)
  })

  it("trims at a word boundary, not mid-word", () => {
    const words = ["kahvaltı", "dahil", "ücretsiz", "iptal"]
    const payload = buildCarouselPayload(TO, "Odalar", [
      {
        ...cards[0],
        body: `*Standart Çift Kişilik* · 2 Kişi · 18 m²\n${Array.from(
          { length: 40 },
          (_, i) => words[i % words.length]
        ).join(" ")}`,
      },
      cards[1],
    ])
    const text = payload.interactive.action.cards[0].body?.text ?? ""
    assert.ok(text.length <= 160, `got ${text.length}`)
    // Whatever the cut landed on, the last word survived whole.
    assert.ok(words.includes(text.split(/\s/).pop() ?? ""), text.slice(-24))
  })

  it("closes emphasis the trim left hanging", () => {
    // A cut between a price and its closing mark would show a literal asterisk.
    const payload = buildCarouselPayload(TO, "Odalar", [
      {
        ...cards[0],
        body: `${"a".repeat(140)} *23.187 TL çok uzun bir fiyat satırı*`,
      },
      cards[1],
    ])
    const text = payload.interactive.action.cards[0].body?.text ?? ""
    assert.equal((text.split("*").length - 1) % 2, 0)
  })

  it("omits the card body when the model wrote none", () => {
    const payload = buildCarouselPayload(TO, "Odalar", [
      { ...cards[0], body: "   " },
      cards[1],
    ])
    assert.equal("body" in payload.interactive.action.cards[0], false)
  })

  it("never sends more than ten cards", () => {
    const payload = buildCarouselPayload(
      TO,
      "Odalar",
      Array.from({ length: 14 }, (_, i) => ({
        imageUrl: `https://cdn.example.com/${i}.jpg`,
        buttons: [{ label: "Seç", url: `https://book.example.com/${i}` }],
      }))
    )
    assert.equal(payload.interactive.action.cards.length, 10)
  })
})

describe("buildCtaUrlPayload", () => {
  it("clamps the display text to 20 characters", () => {
    const payload = buildCtaUrlPayload(
      TO,
      "Rezervasyonunuz hazır",
      "Bu buton etiketi çok uzun",
      "https://example.com/checkout"
    )
    assert.equal(
      payload.interactive.action.parameters.display_text.length,
      20
    )
    assert.equal(
      payload.interactive.action.parameters.url,
      "https://example.com/checkout"
    )
  })
})

describe("buildLocationPayload", () => {
  const PIN = { latitude: 40.99204, longitude: 29.02631 }

  it("sends the coordinates Meta expects, as strings", () => {
    assert.deepEqual(buildLocationPayload(TO, PIN), {
      to: TO,
      type: "location",
      location: { latitude: "40.99204", longitude: "29.02631" },
    })
  })

  it("labels the pin when a name and address are known", () => {
    const payload = buildLocationPayload(TO, {
      ...PIN,
      name: "My Dora Hotel",
      address: "Rıhtım Cad. Tayyareci Sami Sk. No:17, 34716 Kadıköy",
    })
    assert.equal(payload.location.name, "My Dora Hotel")
    assert.match(payload.location.address ?? "", /Tayyareci Sami/)
  })

  it("omits empty labels rather than sending blanks", () => {
    const payload = buildLocationPayload(TO, { ...PIN, name: "  ", address: "" })
    assert.equal("name" in payload.location, false)
    assert.equal("address" in payload.location, false)
  })

  it("strips formatting marks — a pin label renders none", () => {
    const payload = buildLocationPayload(TO, { ...PIN, name: "*My Dora*" })
    assert.equal(payload.location.name, "My Dora")
  })

  it("keeps a negative coordinate intact", () => {
    const payload = buildLocationPayload(TO, {
      latitude: -33.8688,
      longitude: -151.2093,
    })
    assert.equal(payload.location.latitude, "-33.8688")
    assert.equal(payload.location.longitude, "-151.2093")
  })
})
