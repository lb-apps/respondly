import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  detectGuestLocaleFromMessages,
  detectLocaleFromText,
  resolveGuestLocaleFromTexts,
} from "@/lib/assistant/conversation-language"

describe("conversation-language", () => {
  it("detects English from a full guest question", () => {
    assert.equal(
      detectLocaleFromText("Hello, do you have sea-view rooms?"),
      "en"
    )
  })

  it("detects Turkish from Turkish script and words", () => {
    assert.equal(
      detectLocaleFromText("Yarın 2 kişi, 3 gece — fiyat alabilir miyim?"),
      "tr"
    )
  })

  it("treats lone hello as ambiguous and falls back through history", () => {
    assert.equal(
      resolveGuestLocaleFromTexts([
        "Hello, do you have sea-view rooms?",
        "hello",
      ]),
      "en"
    )
  })

  it("defaults to Turkish with no guest context", () => {
    assert.equal(resolveGuestLocaleFromTexts([]), "tr")
  })

  it("switches locale when the guest switches language", () => {
    assert.equal(
      resolveGuestLocaleFromTexts([
        "Merhaba, oda fiyatı alabilir miyim?",
        "Can I book for tomorrow, 2 adults?",
      ]),
      "en"
    )
  })

  it("detects short English confirmations", () => {
    assert.equal(detectLocaleFromText("suite is good"), "en")
    assert.equal(resolveGuestLocaleFromTexts(["suite is good"]), "en")
  })
})

describe("detectGuestLocaleFromMessages", () => {
  it("returns null when nothing they sent says which language", () => {
    // The difference that decides whether their contact card is rewritten.
    assert.equal(
      detectGuestLocaleFromMessages([{ role: "guest", content: "ok" }]),
      null
    )
    assert.equal(detectGuestLocaleFromMessages([]), null)
  })

  it("returns the language when they actually wrote something", () => {
    assert.equal(
      detectGuestLocaleFromMessages([
        { role: "guest", content: "Merhaba, oda var mı?" },
      ]),
      "tr"
    )
  })
})
