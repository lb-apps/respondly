import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { linkParamsFrom } from "@/lib/mcp/link-params"

describe("linkParamsFrom", () => {
  it("takes the marked params, with the values the system already carries", () => {
    assert.deepEqual(
      linkParamsFrom([
        {
          queryParams: { locale: "tr", promo: "yaz2026", secret: "x" },
          linkParams: ["promo"],
        },
      ]),
      [{ name: "promo", value: "yaz2026" }]
    )
  })

  it("knows nothing about the name — any vertical's tag works", () => {
    assert.deepEqual(
      linkParamsFrom([
        {
          queryParams: { ref: "insta", utm_source: "whatsapp" },
          linkParams: ["ref", "utm_source"],
        },
      ]),
      [
        { name: "ref", value: "insta" },
        { name: "utm_source", value: "whatsapp" },
      ]
    )
  })

  it("is empty when nothing is marked", () => {
    assert.deepEqual(
      linkParamsFrom([{ queryParams: { promo: "yaz2026" }, linkParams: [] }]),
      []
    )
    assert.deepEqual(linkParamsFrom([]), [])
  })

  it("drops a marked name whose value was cleared, rather than sending `?ref=`", () => {
    assert.deepEqual(
      linkParamsFrom([{ queryParams: { ref: "   " }, linkParams: ["ref"] }]),
      []
    )
    assert.deepEqual(
      linkParamsFrom([{ queryParams: {}, linkParams: ["ref"] }]),
      []
    )
  })

  it("drops a per-call template — that is not a fixed tag", () => {
    assert.deepEqual(
      linkParamsFrom([
        { queryParams: { locale: "{{guestLocale}}" }, linkParams: ["locale"] },
      ]),
      []
    )
  })

  it("trims, so a stray space never reaches the URL", () => {
    assert.deepEqual(
      linkParamsFrom([{ queryParams: { ref: " insta " }, linkParams: [" ref "] }]),
      [{ name: "ref", value: "insta" }]
    )
  })

  it("collects across systems, first value winning a repeated name", () => {
    assert.deepEqual(
      linkParamsFrom([
        { queryParams: { ref: "first" }, linkParams: ["ref"] },
        { queryParams: { ref: "second", tag: "b" }, linkParams: ["ref", "tag"] },
      ]),
      [
        { name: "ref", value: "first" },
        { name: "tag", value: "b" },
      ]
    )
  })

  it("survives a system with no params at all", () => {
    assert.deepEqual(
      linkParamsFrom([
        { queryParams: null, linkParams: ["ref"] },
        { queryParams: { ref: "x" }, linkParams: undefined },
        { queryParams: { ref: "y" }, linkParams: ["ref"] },
      ]),
      [{ name: "ref", value: "y" }]
    )
  })
})
