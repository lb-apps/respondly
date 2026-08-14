import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  describeSharedLocation,
  sharedLocationMetadata,
} from "@/lib/whatsapp/inbound-location"

describe("describeSharedLocation", () => {
  it("reads the payload Meta documents for a shared place", () => {
    // Before this existed the message carried no text and no media, so the
    // webhook dropped it: we asked where they were and never heard back.
    assert.equal(
      describeSharedLocation({
        latitude: 40.99008,
        longitude: 29.02456,
        name: "My Dora Hotel",
        address: "Rıhtım Cad. No 17",
      }),
      "[location] 40.990080, 29.024560 — My Dora Hotel, Rıhtım Cad. No 17"
    )
  })

  it("works with coordinates alone, which is all WhatsApp guarantees", () => {
    assert.equal(
      describeSharedLocation({ latitude: 41, longitude: 29 }),
      "[location] 41.000000, 29.000000"
    )
  })

  it("says nothing in any human language — it becomes the customer's message", () => {
    // A Turkish sentence here would both mislead the language detection that
    // reads message bodies and read oddly to a German guest. Only the marker
    // and the numbers.
    const text = describeSharedLocation({ latitude: 41, longitude: 29 }) ?? ""
    assert.match(text, /^\[location\] [\d.,\s]+$/)
  })

  it("gives up on a payload with no coordinates", () => {
    assert.equal(describeSharedLocation({ name: "Nowhere" }), null)
    assert.equal(describeSharedLocation(undefined), null)
  })
})

describe("sharedLocationMetadata", () => {
  it("keeps the coordinates as numbers for the inbox map", () => {
    assert.deepEqual(
      sharedLocationMetadata({ latitude: 40.99, longitude: 29.02, name: " Ev " }),
      { location: { latitude: 40.99, longitude: 29.02, name: "Ev" } }
    )
  })

  it("is null when there is nothing to pin", () => {
    assert.equal(sharedLocationMetadata({ address: "x" }), null)
  })
})
