import { test } from "node:test"
import assert from "node:assert/strict"

import { PERSONA_SEEDS } from "./persona-seeds"
import { normalizePhoneE164, isValidPhone } from "@/lib/phone"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"

/**
 * The seeds ship to every organization, so a bad one is a bug nobody would
 * think to look for: an unparseable number breaks the avatar seed and every
 * tool that takes a phone number.
 */

test("every seed phone is a valid E.164 number", () => {
  for (const seed of PERSONA_SEEDS) {
    assert.ok(
      isValidPhone(seed.phone),
      `${seed.label} has an unusable phone: ${seed.phone}`
    )
    assert.equal(
      normalizePhoneE164(seed.phone),
      seed.phone,
      `${seed.label} is not stored in E.164`
    )
  }
})

test("seed phones are unique — the table has a unique index on them", () => {
  const phones = PERSONA_SEEDS.map((seed) => seed.phone)
  assert.equal(new Set(phones).size, phones.length)
})

test("seed languages are guest locales, and country codes are alpha-2", () => {
  for (const seed of PERSONA_SEEDS) {
    if (seed.preferredLanguage) {
      assert.ok(
        GUEST_LOCALES.includes(seed.preferredLanguage),
        `${seed.label} has an unsupported language`
      )
    }
    for (const code of [seed.nationality, seed.country]) {
      if (!code) continue
      assert.match(code, /^[A-Z]{2}$/, `${seed.label} has a bad country code`)
    }
  }
})

test("the first card is the one that knows nothing — it is selected by default", () => {
  const first = PERSONA_SEEDS[0]
  assert.equal(first.firstName, undefined)
  assert.equal(first.lastName, undefined)
  assert.equal(first.email, undefined)
  assert.equal(first.preferredLanguage, undefined)
  assert.ok(first.phone)
})

test("one card carries a team note, so that path is testable out of the box", () => {
  assert.ok(PERSONA_SEEDS.some((seed) => (seed.notes ?? "").trim().length > 0))
})
