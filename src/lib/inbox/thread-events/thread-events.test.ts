import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  CONTACT_PROFILE_COLUMNS,
  CONTACT_PROFILE_FIELDS,
  MAX_EVENT_VALUE_CHARS,
  contactProfileChangeText,
  contactProfileEventText,
  diffContactProfile,
  formatContactProfileValue,
  handoffEventText,
  parseThreadEvent,
  threadEventText,
  type ThreadEvent,
} from "@/lib/inbox/thread-events"

describe("handoffEventText", () => {
  it("names the assistant as the one who let go", () => {
    assert.equal(
      handoffEventText("handoff_to_human"),
      "Asistan konuşmayı ekibe devretti"
    )
  })

  it("names the teammate who took over", () => {
    assert.equal(handoffEventText("takeover", "Ayşe Demir"), "Ayşe Demir konuşmayı devraldı")
  })

  it("falls back to the team when the person is unknown", () => {
    assert.equal(handoffEventText("takeover", null), "Konuşma ekip tarafından devralındı")
    assert.equal(
      handoffEventText("returned_to_assistant"),
      "Konuşma asistana geri verildi"
    )
  })

  it("treats a blank name as no name — never leaves a gap in the sentence", () => {
    assert.equal(handoffEventText("takeover", "   "), "Konuşma ekip tarafından devralındı")
  })

  it("names the teammate who handed it back", () => {
    assert.equal(
      handoffEventText("returned_to_assistant", "Ayşe"),
      "Ayşe konuşmayı asistana geri verdi"
    )
  })
})

describe("parseThreadEvent", () => {
  it("reads a stored handoff", () => {
    assert.deepEqual(
      parseThreadEvent({ event: { kind: "handoff_to_human", reason: "turn_failed" } }),
      { kind: "handoff_to_human", reason: "turn_failed" }
    )
  })

  it("keeps the kind when the reason is missing", () => {
    assert.deepEqual(parseThreadEvent({ event: { kind: "takeover" } }), {
      kind: "takeover",
    })
  })

  it("drops a reason it does not know, keeping the kind", () => {
    assert.deepEqual(
      parseThreadEvent({ event: { kind: "takeover", reason: "spilled_coffee" } }),
      { kind: "takeover" }
    )
  })

  it("is null for an unknown kind — an unreadable row draws nothing", () => {
    assert.equal(parseThreadEvent({ event: { kind: "escalated_to_ceo" } }), null)
    assert.equal(parseThreadEvent({ event: { kind: "contact_deleted" } }), null)
  })

  it("is null for metadata that carries no event at all", () => {
    assert.equal(parseThreadEvent(null), null)
    assert.equal(parseThreadEvent({}), null)
    assert.equal(parseThreadEvent({ attachments: [] }), null)
    assert.equal(parseThreadEvent({ event: "takeover" }), null)
    assert.equal(parseThreadEvent({ event: { kind: 3 } }), null)
    assert.equal(parseThreadEvent("takeover"), null)
  })
})

describe("diffContactProfile", () => {
  it("reports nothing when nothing moved", () => {
    assert.deepEqual(
      diffContactProfile(
        { first_name: "Ali", email: "ali@ornek.com" },
        { first_name: "Ali", email: "ali@ornek.com" }
      ),
      []
    )
  })

  it("puts three changed fields in one event, not three", () => {
    const changes = diffContactProfile(
      { first_name: "Ali", last_name: null, email: null },
      { first_name: "Ali Rıza", last_name: "Yılmaz", email: "ali@ornek.com" }
    )
    assert.equal(changes.length, 3)
    assert.deepEqual(
      changes.map((c) => c.field),
      ["first_name", "last_name", "email"]
    )
  })

  it("follows the declared field order, not the object's", () => {
    const changes = diffContactProfile(
      {},
      { notes: "x", first_name: "Ali", country: "TR" }
    )
    assert.deepEqual(
      changes.map((c) => c.field),
      ["first_name", "country", "notes"]
    )
  })

  it("does not see a change between empty and null", () => {
    assert.deepEqual(diffContactProfile({ email: "" }, { email: null }), [])
    assert.deepEqual(diffContactProfile({ email: "   " }, { email: null }), [])
    assert.deepEqual(diffContactProfile({ email: null }, { email: "" }), [])
  })

  it("compares two-letter codes without their case", () => {
    assert.deepEqual(diffContactProfile({ country: "tr" }, { country: "TR" }), [])
    assert.deepEqual(
      diffContactProfile({ nationality: "DE" }, { nationality: "de" }),
      []
    )
  })

  it("treats tags as a set — reordering is not an edit", () => {
    assert.deepEqual(
      diffContactProfile({ tags: ["vip", "yeni"] }, { tags: ["yeni", "vip"] }),
      []
    )
    assert.deepEqual(
      diffContactProfile({ tags: ["vip"] }, { tags: ["vip", "vip", " vip "] }),
      []
    )
  })

  it("empties a tag list to null rather than to a blank string", () => {
    assert.deepEqual(diffContactProfile({ tags: ["vip"] }, { tags: [] }), [
      { field: "tags", from: "vip", to: null },
    ])
  })

  it("skips a field the writer did not touch", () => {
    assert.deepEqual(
      diffContactProfile({ first_name: "Ali", email: "ali@ornek.com" }, { email: null }),
      [{ field: "email", from: "ali@ornek.com", to: null }]
    )
  })

  it("says the note changed and nothing about what it says", () => {
    const changes = diffContactProfile({ notes: null }, { notes: "Kedisi var" })
    assert.deepEqual(changes, [{ field: "notes" }])
    assert.equal("from" in changes[0], false)
    assert.equal("to" in changes[0], false)
  })

  it("keeps a long note out of the event entirely", () => {
    const secret = "Müşteri gizli notu ".repeat(160)
    const changes = diffContactProfile({ notes: null }, { notes: secret })
    assert.equal(JSON.stringify(changes).includes("gizli"), false)
  })

  it("cuts a value that would not fit, and marks the cut", () => {
    const long = `${"a".repeat(200)}@ornek.com`
    const [change] = diffContactProfile({ email: null }, { email: long })
    assert.equal(change.to?.length, MAX_EVENT_VALUE_CHARS + 1)
    assert.equal(change.to?.endsWith("…"), true)
  })
})

describe("parseContactProfilePayload, through parseThreadEvent", () => {
  const wrap = (changes: unknown) => ({
    event: { kind: "contact_profile_updated", changes },
  })

  it("round-trips what the differ produced", () => {
    const changes = diffContactProfile(
      { first_name: "Ali", notes: null },
      { first_name: "Ali Rıza", notes: "x" }
    )
    assert.deepEqual(parseThreadEvent(wrap(changes)), {
      kind: "contact_profile_updated",
      changes,
    })
  })

  it("is null when there is nothing to say", () => {
    assert.equal(parseThreadEvent(wrap([])), null)
    assert.equal(parseThreadEvent(wrap(undefined)), null)
    assert.equal(parseThreadEvent(wrap("first_name")), null)
    assert.equal(parseThreadEvent(wrap([{}])), null)
  })

  it("drops a field it does not know and keeps the rest", () => {
    assert.deepEqual(
      parseThreadEvent(
        wrap([
          { field: "passport_no", from: null, to: "X1" },
          { field: "email", from: null, to: "ali@ornek.com" },
        ])
      ),
      {
        kind: "contact_profile_updated",
        changes: [{ field: "email", from: null, to: "ali@ornek.com" }],
      }
    )
    assert.equal(parseThreadEvent(wrap([{ field: "passport_no" }])), null)
  })

  it("strips a note's values even when the row carries them", () => {
    assert.deepEqual(
      parseThreadEvent(wrap([{ field: "notes", from: "eski not", to: "yeni not" }])),
      { kind: "contact_profile_updated", changes: [{ field: "notes" }] }
    )
  })

  it("refuses a value that is not text — never renders [object Object]", () => {
    assert.equal(parseThreadEvent(wrap([{ field: "email", to: 42 }])), null)
    assert.equal(parseThreadEvent(wrap([{ field: "email", to: { a: 1 } }])), null)
    assert.equal(parseThreadEvent(wrap([{ field: "email", from: ["a"] }])), null)
  })

  it("caps a changes array longer than the card has fields", () => {
    const many = Array.from({ length: 40 }, () => ({
      field: "email",
      from: null,
      to: "ali@ornek.com",
    }))
    const event = parseThreadEvent(wrap(many))
    assert.equal(
      event && "changes" in event ? event.changes.length : -1,
      CONTACT_PROFILE_FIELDS.length
    )
  })
})

describe("contactProfileEventText", () => {
  const changes = diffContactProfile(
    { first_name: null, email: null },
    { first_name: "Ali", email: "ali@ornek.com" }
  )

  it("names the teammate who edited the card", () => {
    assert.equal(
      contactProfileEventText(changes, { name: "Ayşe Demir" }),
      "Ayşe Demir kişi kartını güncelledi: Ad, E-posta"
    )
  })

  it("leaves the assistant unnamed — its reply is right above the line", () => {
    assert.equal(
      contactProfileEventText(changes, null),
      "Kişi kartı güncellendi: Ad, E-posta"
    )
  })

  it("does not let a nameless teammate read as the assistant", () => {
    assert.equal(
      contactProfileEventText(changes, { name: null }),
      "Ekip kişi kartını güncelledi: Ad, E-posta"
    )
    assert.equal(
      contactProfileEventText(changes, { name: "   " }),
      "Ekip kişi kartını güncelledi: Ad, E-posta"
    )
  })

  it("names the note without repeating it", () => {
    assert.equal(
      contactProfileEventText([{ field: "notes" }], { name: "Ayşe" }),
      "Ayşe kişi kartını güncelledi: Not"
    )
  })
})

describe("threadEventText", () => {
  it("dispatches on kind, and reads the actor the same way for both families", () => {
    assert.equal(
      threadEventText({ kind: "takeover" }, { name: "Ayşe" }),
      "Ayşe konuşmayı devraldı"
    )
    assert.equal(
      threadEventText({ kind: "takeover" }, null),
      "Konuşma ekip tarafından devralındı"
    )
  })

  it("drops the field list on screen — the chips under it say the same thing", () => {
    const event: ThreadEvent = {
      kind: "contact_profile_updated",
      changes: [{ field: "notes" }],
    }

    assert.equal(threadEventText(event, null), "Kişi kartı güncellendi")
    assert.equal(
      threadEventText(event, { name: "Ayşe" }),
      "Ayşe kişi kartını güncelledi"
    )

    // The stored sentence keeps them: search has nothing else to match on.
    assert.equal(
      contactProfileEventText(event.changes, null),
      "Kişi kartı güncellendi: Not"
    )
  })
})

describe("formatContactProfileValue", () => {
  it("turns a stored language code into a word", () => {
    assert.equal(formatContactProfileValue("preferred_language", "de"), "Almanca")
  })

  it("shows an unknown code rather than nothing", () => {
    assert.equal(formatContactProfileValue("preferred_language", "xx"), "xx")
  })

  it("marks an empty value with a dash", () => {
    assert.equal(formatContactProfileValue("email", null), "—")
    assert.equal(formatContactProfileValue("email", ""), "—")
  })
})

describe("contactProfileChangeText", () => {
  it("says an empty value in a word, not a dash", () => {
    assert.equal(
      contactProfileChangeText({ field: "email", from: null, to: "ali@ornek.com" }),
      "E-posta: boş yerine ali@ornek.com"
    )
  })

  it("reads a language change in words on both sides", () => {
    assert.equal(
      contactProfileChangeText({ field: "preferred_language", from: "tr", to: "de" }),
      "Tercih edilen dil: Türkçe yerine Almanca"
    )
  })

  it("says only that the note changed", () => {
    assert.equal(contactProfileChangeText({ field: "notes" }), "Not güncellendi")
  })
})

describe("CONTACT_PROFILE_COLUMNS", () => {
  it("still lists exactly the fields the differ walks", () => {
    // Written out by hand so supabase-js can type the row it selects; this is
    // what stops the two from drifting apart.
    assert.equal(CONTACT_PROFILE_COLUMNS, CONTACT_PROFILE_FIELDS.join(", "))
  })
})
