import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  WHATSAPP_IMAGE_MAX_BYTES,
  mediaCacheExpiry,
  normalizeMimeType,
  unsupportedAsImage,
} from "@/lib/whatsapp/cloud-api/media-limits"

describe("normalizeMimeType", () => {
  it("strips parameters and lower-cases", () => {
    assert.equal(normalizeMimeType("IMAGE/PNG; charset=binary"), "image/png")
  })

  it("folds the image/jpg spelling Meta does not know", () => {
    assert.equal(normalizeMimeType("image/jpg"), "image/jpeg")
  })

  it("survives a missing content-type", () => {
    assert.equal(normalizeMimeType(""), "")
  })
})

describe("unsupportedAsImage", () => {
  it("accepts the two formats Meta renders", () => {
    assert.equal(unsupportedAsImage({ mimeType: "image/jpeg", byteSize: 1024 }), null)
    assert.equal(unsupportedAsImage({ mimeType: "image/png", byteSize: 1024 }), null)
  })

  it("rejects webp, which Meta accepts at send time and then fails to deliver", () => {
    assert.match(
      unsupportedAsImage({ mimeType: "image/webp", byteSize: 1024 }) ?? "",
      /unsupported image type image\/webp/
    )
  })

  it("rejects an empty body", () => {
    assert.equal(unsupportedAsImage({ mimeType: "image/png", byteSize: 0 }), "empty file")
  })

  it("rejects anything over the 5MB ceiling", () => {
    assert.equal(
      unsupportedAsImage({
        mimeType: "image/jpeg",
        byteSize: WHATSAPP_IMAGE_MAX_BYTES,
      }),
      null
    )
    assert.match(
      unsupportedAsImage({
        mimeType: "image/jpeg",
        byteSize: WHATSAPP_IMAGE_MAX_BYTES + 1,
      }) ?? "",
      /over Meta's 5MB limit/
    )
  })
})

describe("mediaCacheExpiry", () => {
  it("expires before Meta drops the id at 30 days", () => {
    const uploadedAt = new Date("2026-01-01T00:00:00.000Z")
    const expiry = mediaCacheExpiry(uploadedAt)
    const days = (expiry.getTime() - uploadedAt.getTime()) / 86_400_000
    assert.ok(days > 0 && days < 30, `expected under 30 days, got ${days}`)
  })
})
