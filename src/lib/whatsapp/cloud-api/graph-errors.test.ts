import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { graphErrorToTurkish } from "@/lib/whatsapp/cloud-api/graph-errors"
import type { GraphError } from "@/lib/whatsapp/cloud-api/graph-request"

function error(partial: Partial<GraphError>): GraphError {
  return { status: 500, message: "boom", ...partial }
}

describe("graphErrorToTurkish", () => {
  it("names the token on a 401", () => {
    assert.match(graphErrorToTurkish(error({ status: 401 })), /Erişim anahtarı/)
  })

  it("recognises Meta's code 190 even when the status is not 401", () => {
    // Meta answers an expired token with 400 + code 190 as often as with 401.
    assert.match(
      graphErrorToTurkish(error({ status: 400, code: 190 })),
      /Erişim anahtarı/
    )
  })

  it("names the missing permission on a 403", () => {
    assert.match(
      graphErrorToTurkish(error({ status: 403 })),
      /whatsapp_business_management/
    )
  })

  it("points at the Phone Number ID on a 404", () => {
    assert.match(graphErrorToTurkish(error({ status: 404 })), /Phone Number ID/)
  })

  it("asks for patience on a 429", () => {
    assert.match(graphErrorToTurkish(error({ status: 429 })), /istek sınırına/)
  })

  it("passes Meta's own wording through on a 400, where it names the field", () => {
    assert.equal(
      graphErrorToTurkish(error({ status: 400, message: "Invalid email" })),
      "Meta bu bilgiyi kabul etmedi: Invalid email"
    )
  })

  it("treats a network failure (status 0) as unreachable", () => {
    assert.match(graphErrorToTurkish(error({ status: 0 })), /ulaşılamıyor/)
  })

  it("falls back to a generic message with the status", () => {
    assert.equal(
      graphErrorToTurkish(error({ status: 418, message: "teapot" })),
      "Meta hatası (418): teapot"
    )
  })

  it("never echoes a token, whatever Meta put in the message", () => {
    // The security assertion: only the 400 branch forwards Meta's text, and a
    // token-shaped string must not survive any other branch.
    const token = "EAAG1234567890secretsecretsecret"
    for (const status of [401, 403, 404, 429, 500, 0]) {
      const message = graphErrorToTurkish(error({ status, message: token }))
      assert.ok(
        !message.includes(token),
        `status ${status} leaked the token: ${message}`
      )
    }
  })
})
