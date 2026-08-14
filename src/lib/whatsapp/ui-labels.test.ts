import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { optionsLabel } from "@/lib/whatsapp/ui-labels"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"

describe("optionsLabel", () => {
  it("never shows a German or Russian customer a Turkish word", () => {
    assert.equal(optionsLabel("de"), "Optionen")
    assert.equal(optionsLabel("ru"), "Варианты")
    assert.equal(optionsLabel("en"), "Options")
    assert.equal(optionsLabel("tr"), "Seçenekler")
  })

  it("falls back to Turkish when the locale is unknown or missing", () => {
    assert.equal(optionsLabel(null), "Seçenekler")
    assert.equal(optionsLabel("fr"), "Seçenekler")
  })

  it("fits Meta's 24-character list label limit in every language", () => {
    for (const locale of GUEST_LOCALES) {
      assert.ok(
        optionsLabel(locale).length <= 20,
        `${locale} label is too long for a list button`
      )
    }
  })
})
