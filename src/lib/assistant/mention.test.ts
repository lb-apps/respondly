import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  applyMention,
  findActiveMention,
  mentionText,
} from "@/lib/assistant/mention"

describe("findActiveMention", () => {
  it("opens on @ at the start of the text", () => {
    assert.deepEqual(findActiveMention("@sea", 4), { start: 0, query: "sea" })
  })

  it("opens on @ after a space or newline", () => {
    assert.deepEqual(findActiveMention("kullan @sea", 11), {
      start: 7,
      query: "sea",
    })
    assert.deepEqual(findActiveMention("kullan\n@x", 9), { start: 7, query: "x" })
  })

  it("treats a bare @ as an open mention with an empty query", () => {
    // Typing just "@" should already show the whole menu.
    assert.deepEqual(findActiveMention("kullan @", 8), { start: 7, query: "" })
  })

  it("is not fooled by an email address", () => {
    assert.equal(findActiveMention("eemirerdo@icloud.com", 20), null)
  })

  it("closes once a space is typed", () => {
    assert.equal(findActiveMention("@search_knowledge tool", 22), null)
  })

  it("works mid-document, not just at the end", () => {
    const value = "önce @sea sonra devam eden uzun bir cümle"
    assert.deepEqual(findActiveMention(value, 9), { start: 5, query: "sea" })
  })

  it("returns nothing when the caret sits in ordinary prose", () => {
    assert.equal(findActiveMention("düz bir cümle", 8), null)
  })

  it("keeps dots, dashes and underscores, which tool names use", () => {
    assert.deepEqual(findActiveMention("@my_dora-v2.1", 13), {
      start: 0,
      query: "my_dora-v2.1",
    })
  })
})

describe("applyMention", () => {
  it("replaces the mention and reports where the caret lands", () => {
    const value = "Müsaitlik için @sea kullan"
    const mention = findActiveMention(value, 19)!
    const next = applyMention(value, mention, "`mydora_search_availability`")

    assert.equal(
      next.value,
      "Müsaitlik için `mydora_search_availability` kullan"
    )
    // Caret lands past the token and its space, ready for the next word.
    assert.equal(next.value[next.caret - 1], " ")
    assert.equal(next.value.slice(next.caret), "kullan")
  })

  it("does not double a space that is already there", () => {
    const value = "@sea sonra"
    const next = applyMention(value, findActiveMention(value, 4)!, "`x`")
    assert.equal(next.value, "`x` sonra")
  })

  it("appends a trailing space at the end of the text", () => {
    const value = "kullan @sea"
    const next = applyMention(value, findActiveMention(value, 11)!, "`x`")
    assert.equal(next.value, "kullan `x` ")
    assert.equal(next.caret, next.value.length)
  })
})

describe("mentionText", () => {
  it("writes the tool the way the prompt already lists it", () => {
    assert.equal(mentionText("mydora_get_photos"), "`mydora_get_photos`")
  })
})
