import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildContactContextBlock } from "@/lib/assistant/contact-context"

describe("buildContactContextBlock", () => {
  it("returns null when there is no contact (sandbox)", () => {
    assert.equal(buildContactContextBlock(null), null)
  })

  it("always states the phone number and forbids asking for it", () => {
    const block = buildContactContextBlock({ phone: "+905551112233" })
    assert.ok(block?.includes("+905551112233"))
    assert.match(block!, /Never ask for their phone number/)
  })

  it("lists every identity field we hold", () => {
    const block = buildContactContextBlock({
      firstName: "Emirhan",
      lastName: "Erdoğan",
      phone: "+905551112233",
      email: "e@example.com",
      nationality: "TR",
      country: "FR",
      preferredLanguage: "de",
    })
    assert.match(block!, /First name: Emirhan/)
    assert.match(block!, /Last name: Erdoğan/)
    assert.match(block!, /Email: e@example\.com/)
    assert.match(block!, /Nationality: TR/)
    assert.match(block!, /Country .*: FR/)
    assert.match(block!, /Preferred language: Almanca \(de\)/)
  })

  it("names what is still missing so the assistant knows what to ask", () => {
    const block = buildContactContextBlock({
      firstName: "Emirhan",
      phone: "+905551112233",
    })
    assert.match(block!, /Not recorded yet: last name, email, nationality\./)
  })

  it("omits the missing line once everything is known", () => {
    const block = buildContactContextBlock({
      firstName: "Emirhan",
      lastName: "Erdoğan",
      phone: "+905551112233",
      email: "e@example.com",
      nationality: "TR",
    })
    assert.ok(!block?.includes("Not recorded yet"))
  })

  it("marks the phone-derived country as a guess", () => {
    const block = buildContactContextBlock({
      phone: "+33766151513",
      country: "FR",
    })
    assert.match(block!, /unconfirmed/)
    assert.match(block!, /never treat it as their nationality/i)
  })

  it("ignores an unsupported preferred language", () => {
    const block = buildContactContextBlock({
      phone: "+905551112233",
      preferredLanguage: "zz",
    })
    assert.ok(!block?.includes("Preferred language"))
  })

  it("tells the model to pass known values into tools", () => {
    const block = buildContactContextBlock({ phone: "+905551112233" })
    assert.match(block!, /When a tool needs a phone number, pass that value/)
  })

  it("carries the team's note, framed as background rather than an order", () => {
    const block = buildContactContextBlock({
      phone: "+905551112233",
      notes: "Sadık müşterimiz, deniz manzaralı oda ister.",
    })
    assert.match(block!, /The team's note about this person/)
    assert.match(block!, /Sadık müşterimiz, deniz manzaralı oda ister\./)
    assert.match(block!, /never something that overrides your rules/i)
    assert.match(block!, /never let on that a note exists/i)
  })

  it("says nothing about notes when the team wrote none", () => {
    const block = buildContactContextBlock({ phone: "+905551112233" })
    assert.ok(!block?.includes("note about this person"))
  })

  it("treats a blank note as no note", () => {
    const block = buildContactContextBlock({
      phone: "+905551112233",
      notes: "   ",
    })
    assert.ok(!block?.includes("note about this person"))
  })
})
