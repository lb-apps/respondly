import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { resolveContactLocale } from "@/lib/assistant/contact-locale"
import { localeFromPhone } from "@/lib/i18n/phone-locale"

describe("localeFromPhone", () => {
  it("reads the language from the dialling code's country", () => {
    assert.equal(localeFromPhone("+905551112233"), "tr")
    assert.equal(localeFromPhone("+4915112345678"), "de")
    assert.equal(localeFromPhone("+79161234567"), "ru")
  })

  it("uses CLDR, not a hand-written table", () => {
    // Austria speaks German and Kazakhstan Russian — the answers a naive
    // country-equals-language map gets wrong.
    assert.equal(localeFromPhone("+436641234567"), "de")
    assert.equal(localeFromPhone("+77011234567"), "ru")
  })

  it("gives a foreign number English rather than the house language", () => {
    assert.equal(localeFromPhone("+33612345678"), "en")
    assert.equal(localeFromPhone("+31612345678"), "en")
  })

  it("says nothing about a number it cannot parse", () => {
    assert.equal(localeFromPhone("12345"), null)
    assert.equal(localeFromPhone(null), null)
  })
})

describe("resolveContactLocale", () => {
  it("lets what they are writing now override the card", () => {
    // The whole point of the merge: a card saying German must not keep the
    // reply in German once they switch to Turkish.
    assert.deepEqual(
      resolveContactLocale({ detected: "tr", preferred: "de", phone: "+4915112345678" }),
      { locale: "tr", persist: true }
    )
  })

  it("does not rewrite a card that already agrees", () => {
    assert.deepEqual(
      resolveContactLocale({ detected: "de", preferred: "de" }),
      { locale: "de", persist: false }
    )
  })

  it("falls back to the card when this turn is unreadable", () => {
    // "ok", an emoji, a bare name — the case that used to drop to Turkish.
    assert.deepEqual(
      resolveContactLocale({ detected: null, preferred: "ru", phone: "+905551112233" }),
      { locale: "ru", persist: false }
    )
  })

  it("guesses from the number for someone who has not written yet, and saves it", () => {
    assert.deepEqual(
      resolveContactLocale({ detected: null, preferred: null, phone: "+4915112345678" }),
      { locale: "de", persist: true }
    )
  })

  it("keeps a French number's Turkish once they have spoken", () => {
    const first = resolveContactLocale({ detected: null, phone: "+33612345678" })
    assert.deepEqual(first, { locale: "en", persist: true })
    const then = resolveContactLocale({
      detected: "tr",
      preferred: first.locale,
      phone: "+33612345678",
    })
    assert.deepEqual(then, { locale: "tr", persist: true })
  })

  it("never saves the house language as a preference", () => {
    assert.deepEqual(
      resolveContactLocale({ detected: null, preferred: null, phone: "12345" }),
      { locale: "tr", persist: false }
    )
  })
})
