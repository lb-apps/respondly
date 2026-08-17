import { test } from "node:test"
import assert from "node:assert/strict"

import { parsePersonaSnapshot } from "./profile-store"

/**
 * The snapshot is jsonb, so nothing about its shape is guaranteed. Everything
 * downstream — the prompt block, the profile tools — trusts what comes back
 * from here, which makes this the boundary worth proving.
 */

test("a full snapshot round-trips", () => {
  const profile = parsePersonaSnapshot({
    firstName: "Ayşe",
    lastName: "Yıldırım",
    phone: "+905321110002",
    email: "ayse@example.com",
    nationality: "TR",
    country: "TR",
    preferredLanguage: "tr",
    notes: "Sadık müşterimiz.",
  })

  assert.deepEqual(profile, {
    firstName: "Ayşe",
    lastName: "Yıldırım",
    phone: "+905321110002",
    email: "ayse@example.com",
    nationality: "TR",
    country: "TR",
    preferredLanguage: "tr",
    notes: "Sadık müşterimiz.",
  })
})

test("missing and empty fields read as null, not as empty strings", () => {
  const profile = parsePersonaSnapshot({ phone: "+905321110001", firstName: "" })

  assert.equal(profile?.phone, "+905321110001")
  assert.equal(profile?.firstName, null)
  assert.equal(profile?.email, null)
  assert.equal(profile?.notes, null)
})

test("non-string values are dropped rather than trusted", () => {
  const profile = parsePersonaSnapshot({
    phone: "+905321110001",
    firstName: 42,
    notes: { text: "nope" },
  })

  assert.equal(profile?.firstName, null)
  assert.equal(profile?.notes, null)
})

test("a session with no persona has no profile", () => {
  assert.equal(parsePersonaSnapshot(null), null)
  assert.equal(parsePersonaSnapshot(undefined), null)
  assert.equal(parsePersonaSnapshot("nope"), null)
  assert.equal(parsePersonaSnapshot([1, 2]), null)
})
