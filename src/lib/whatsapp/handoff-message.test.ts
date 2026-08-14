import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { handoffMessage } from "@/lib/whatsapp/handoff-message"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"

describe("handoffMessage", () => {
  it("speaks the customer's language", () => {
    assert.match(handoffMessage("tr"), /arkadaşıma aktarıyorum/)
    assert.match(handoffMessage("en"), /colleague/)
    assert.match(handoffMessage("de"), /Kollegin/)
    assert.match(handoffMessage("ru"), /коллеге/)
  })

  it("falls back to Turkish for an unknown or missing locale", () => {
    assert.equal(handoffMessage(null), handoffMessage("tr"))
    assert.equal(handoffMessage("fr"), handoffMessage("tr"))
    assert.equal(handoffMessage(undefined), handoffMessage("tr"))
  })

  it("accepts a full BCP-47 tag", () => {
    assert.equal(handoffMessage("en-GB"), handoffMessage("en"))
  })

  it("has a line for every supported locale and both reasons", () => {
    for (const locale of GUEST_LOCALES) {
      for (const reason of ["no_answer", "failure"] as const) {
        const line = handoffMessage(locale, reason)
        assert.ok(line.trim().length > 0, `${locale}/${reason} is empty`)
      }
    }
  })

  it("never blames a technical failure — the customer only needs to know a person is on it", () => {
    for (const locale of GUEST_LOCALES) {
      assert.doesNotMatch(
        handoffMessage(locale, "failure"),
        /hata|error|Fehler|ошибк|technical|teknik/i
      )
    }
  })
})
