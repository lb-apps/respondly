import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  EMPTY_PROFILE_CACHE,
  readProfileCache,
  writeProfileCache,
} from "@/lib/whatsapp/profile/channel-settings"

describe("readProfileCache", () => {
  it("returns the empty cache for a channel that has never synced", () => {
    assert.deepEqual(readProfileCache(null), EMPTY_PROFILE_CACHE)
    assert.deepEqual(readProfileCache({}), EMPTY_PROFILE_CACHE)
  })

  it("survives every shape the Json column allows", () => {
    // `settings` is typed Json, so a string, a number and an array are all
    // legal values that must not throw on the settings page.
    assert.deepEqual(readProfileCache("garbage"), EMPTY_PROFILE_CACHE)
    assert.deepEqual(readProfileCache([]), EMPTY_PROFILE_CACHE)
    assert.deepEqual(readProfileCache(42), EMPTY_PROFILE_CACHE)
    assert.deepEqual(
      readProfileCache({ whatsappProfile: "not an object" }),
      EMPTY_PROFILE_CACHE
    )
  })

  it("reads a full mirror back", () => {
    const cache = readProfileCache({
      whatsappProfile: {
        about: "Deniz manzaralı",
        description: "Butik otel",
        address: "Antalya",
        email: "a@b.com",
        vertical: "HOTEL",
        websites: ["https://a.com", "https://b.com"],
        pictureStoragePath: "org/pic.jpg",
        syncedAt: "2026-08-12T10:00:00.000Z",
      },
    })
    assert.equal(cache.about, "Deniz manzaralı")
    assert.equal(cache.vertical, "HOTEL")
    assert.deepEqual(cache.websites, ["https://a.com", "https://b.com"])
    assert.equal(cache.pictureStoragePath, "org/pic.jpg")
  })

  it("falls back to OTHER for a vertical Meta no longer lists", () => {
    const cache = readProfileCache({ whatsappProfile: { vertical: "SPACESHIPS" } })
    assert.equal(cache.vertical, "OTHER")
  })

  it("drops non-string websites and caps at two", () => {
    const cache = readProfileCache({
      whatsappProfile: { websites: ["https://a.com", 5, "https://b.com", "https://c.com"] },
    })
    assert.deepEqual(cache.websites, ["https://a.com", "https://b.com"])
  })
})

describe("writeProfileCache", () => {
  it("preserves keys belonging to other features", () => {
    // The clobber regression: `settings` is shared, and a profile save must not
    // wipe a sibling key.
    const next = writeProfileCache(
      { conversationalAutomation: { enabled: true } },
      { ...EMPTY_PROFILE_CACHE, about: "yeni" }
    ) as Record<string, Record<string, unknown>>

    assert.deepEqual(next.conversationalAutomation, { enabled: true })
    assert.equal(next.whatsappProfile.about, "yeni")
  })

  it("round-trips through readProfileCache", () => {
    const cache = { ...EMPTY_PROFILE_CACHE, about: "x", vertical: "HOTEL" as const }
    assert.deepEqual(readProfileCache(writeProfileCache(null, cache)), cache)
  })

  it("replaces a previous mirror rather than merging into it", () => {
    const first = writeProfileCache(null, {
      ...EMPTY_PROFILE_CACHE,
      about: "eski",
      email: "a@b.com",
    })
    const second = readProfileCache(
      writeProfileCache(first, { ...EMPTY_PROFILE_CACHE, about: "yeni" })
    )
    assert.equal(second.about, "yeni")
    // A field the org cleared in Meta must not survive in our copy.
    assert.equal(second.email, "")
  })
})
