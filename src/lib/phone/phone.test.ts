import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  formatPhoneDisplay,
  getPhoneCountry,
  isValidPhone,
  normalizePhoneE164,
  toWhatsAppHref,
} from "@/lib/phone"

describe("normalizePhoneE164", () => {
  it("adds + prefix to bare digits", () => {
    assert.equal(normalizePhoneE164("905362862998"), "+905362862998")
  })

  it("is idempotent for E.164", () => {
    assert.equal(normalizePhoneE164("+905362862998"), "+905362862998")
  })
})

describe("formatPhoneDisplay", () => {
  it("formats Turkish mobile internationally", () => {
    assert.equal(formatPhoneDisplay("+905362862998"), "+90 536 286 29 98")
  })

  it("formats without leading plus", () => {
    assert.equal(formatPhoneDisplay("905362862998"), "+90 536 286 29 98")
  })

  it("formats French numbers", () => {
    const formatted = formatPhoneDisplay("+33661594711")
    assert.match(formatted, /^\+33/)
    assert.ok(formatted.includes(" "))
  })

  it("returns em dash for empty", () => {
    assert.equal(formatPhoneDisplay(""), "—")
    assert.equal(formatPhoneDisplay(null), "—")
  })
})

describe("getPhoneCountry", () => {
  it("detects TR", () => {
    assert.equal(getPhoneCountry("+905362862998"), "TR")
  })
})

describe("isValidPhone", () => {
  it("validates real numbers", () => {
    assert.equal(isValidPhone("+905362862998"), true)
  })

  it("rejects garbage", () => {
    assert.equal(isValidPhone("abc"), false)
  })
})

describe("toWhatsAppHref", () => {
  it("builds wa.me link", () => {
    assert.equal(toWhatsAppHref("+905362862998"), "https://wa.me/905362862998")
  })
})
