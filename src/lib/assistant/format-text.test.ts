import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  dropTextEchoedByRichContent,
  formatAssistantMessageText,
} from "@/lib/assistant/format-text"

describe("the model's sentences are left alone", () => {
  it("never cuts a word out of a sentence to avoid repeating a caption", () => {
    // This is the bug that ended the caption-stripping experiment: removing the
    // room name mid-clause stranded its Turkish suffix and reached a guest as
    // "İşte 'dan birkaç".
    const text = "İşte Standart İki Yataklı Oda'dan birkaç fotoğraf."
    const out = formatAssistantMessageText(text, [
      { type: "image", imageUrl: "https://example.com/a.jpg" },
    ])
    assert.equal(out, text)
  })

  it("still removes a raw URL, which is never right in a bubble", () => {
    const out = formatAssistantMessageText(
      "İşte odamız https://example.com/a.jpg",
      [{ type: "image", imageUrl: "https://example.com/a.jpg" }]
    )
    assert.equal(out, "İşte odamız")
  })
})

describe("sentences glued by a multi-step turn", () => {
  it("separates a sentence end run straight into the next capital", () => {
    // The model wrote once before a tool call and once after; the two parts
    // arrive as one string with nothing between them.
    const out = formatAssistantMessageText(
      "Rezervasyon bağlantınızı hazırlıyorum.Bağlantıyı hazırladım.",
      []
    )
    assert.equal(
      out,
      "Rezervasyon bağlantınızı hazırlıyorum. Bağlantıyı hazırladım."
    )
  })

  it("handles question and exclamation marks too", () => {
    assert.equal(
      formatAssistantMessageText("Hangi tarih?Bakayım.", []),
      "Hangi tarih? Bakayım."
    )
  })

  it("leaves prices and times alone", () => {
    // A digit follows the dot, never a capital, so these are never touched.
    const text = "Toplam 1.500 TL, çıkış 12.00'de. Kolay gelsin."
    assert.equal(formatAssistantMessageText(text, []), text)
  })

  it("does not insert a space where one already exists", () => {
    const text = "Açığız. Yarın da açığız."
    assert.equal(formatAssistantMessageText(text, []), text)
  })

  it("leaves a lower-case continuation alone", () => {
    // Abbreviations mid-sentence must not be broken apart.
    const text = "Havlu, şampuan vb.malzemeler odada."
    assert.equal(formatAssistantMessageText(text, []), text)
  })
})

describe("dropTextEchoedByRichContent", () => {
  const cta = {
    type: "cta",
    body: "Şehir manzaralı, 14 m², çiftler için ideal Standart Çift Kişilik Oda.",
    url: "https://example.com/room",
  }

  it("drops a reply that repeats the button's own line", () => {
    // What the model actually produced: the same sentence as text and above
    // the button, so the guest reads it twice.
    assert.equal(
      dropTextEchoedByRichContent(
        "Şehir manzaralı, 14 m², çiftler için ideal Standart Çift Kişilik Oda.",
        [cta]
      ),
      ""
    )
  })

  it("ignores punctuation and emphasis when comparing", () => {
    assert.equal(
      dropTextEchoedByRichContent("*Şehir manzaralı*, 14 m² — çiftler için ideal Standart Çift Kişilik Oda", [cta]),
      ""
    )
  })

  it("keeps a reply that says something the body does not", () => {
    const text = "Kahvaltı 07:00-10:00 arası veriliyor."
    assert.equal(dropTextEchoedByRichContent(text, [cta]), text)
  })

  it("leaves text alone when there is no rich content", () => {
    assert.equal(dropTextEchoedByRichContent("Merhaba", []), "Merhaba")
  })
})
