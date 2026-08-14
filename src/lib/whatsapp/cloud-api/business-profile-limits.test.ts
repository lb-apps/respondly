import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  PROFILE_ABOUT_MAX,
  PROFILE_ADDRESS_MAX,
  PROFILE_DESCRIPTION_MAX,
  PROFILE_EMAIL_MAX,
  PROFILE_PHOTO_MIME_TYPES,
  PROFILE_WEBSITES_MAX,
  PROFILE_WEBSITE_MAX,
  WHATSAPP_VERTICALS,
  sanitizeWebsites,
} from "@/lib/whatsapp/cloud-api/business-profile-limits"

describe("WHATSAPP_VERTICALS", () => {
  it("carries all 21 categories Meta accepts", () => {
    assert.equal(WHATSAPP_VERTICALS.length, 21)
  })

  it("includes the two we depend on by name", () => {
    // HOTEL is the product's first vertical and the Select's smart default;
    // OTHER is the fallback the cache falls back to. A typo in either silently
    // drops an option from the form instead of failing.
    assert.ok(WHATSAPP_VERTICALS.includes("HOTEL"))
    assert.ok(WHATSAPP_VERTICALS.includes("OTHER"))
  })

  it("has no duplicates", () => {
    assert.equal(new Set(WHATSAPP_VERTICALS).size, WHATSAPP_VERTICALS.length)
  })
})

describe("profile field limits", () => {
  it("matches Meta's documented caps", () => {
    // Written out rather than derived: this test *is* the documentation, and a
    // silent edit to a constant should break it.
    assert.equal(PROFILE_ABOUT_MAX, 139)
    assert.equal(PROFILE_DESCRIPTION_MAX, 512)
    assert.equal(PROFILE_ADDRESS_MAX, 256)
    assert.equal(PROFILE_EMAIL_MAX, 128)
    assert.equal(PROFILE_WEBSITE_MAX, 256)
    assert.equal(PROFILE_WEBSITES_MAX, 2)
  })

  it("excludes webp from profile photos, which Meta accepts then never renders", () => {
    assert.ok(PROFILE_PHOTO_MIME_TYPES.has("image/jpeg"))
    assert.ok(PROFILE_PHOTO_MIME_TYPES.has("image/png"))
    assert.ok(!PROFILE_PHOTO_MIME_TYPES.has("image/webp"))
  })
})

describe("sanitizeWebsites", () => {
  it("trims, drops blanks and caps at Meta's two", () => {
    assert.deepEqual(
      sanitizeWebsites(["  https://a.com ", "", "https://b.com", "https://c.com"]),
      ["https://a.com", "https://b.com"]
    )
  })

  it("survives the empty form", () => {
    assert.deepEqual(sanitizeWebsites(["", "   "]), [])
  })

  it("treats undefined and null like a blank field", () => {
    assert.deepEqual(sanitizeWebsites([undefined, "https://a.com", null]), [
      "https://a.com",
    ])
  })
})
