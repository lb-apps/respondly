import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { isPrivateHostname, unreachableByMeta } from "@/lib/whatsapp/public-url"

describe("unreachableByMeta", () => {
  it("accepts a public https media URL", () => {
    assert.equal(
      unreachableByMeta("https://cdn.example.com/rooms/suite.jpg"),
      null
    )
  })

  it("accepts a public http URL", () => {
    assert.equal(unreachableByMeta("http://example.com/a.jpg"), null)
  })

  it("rejects localhost — the exact case that silently failed", () => {
    const reason = unreachableByMeta(
      "http://localhost:3001/media/hotel/areas/terrace/terrace-01.jpg"
    )
    assert.match(reason!, /only reachable from this machine/)
  })

  it("rejects private LAN addresses", () => {
    assert.ok(unreachableByMeta("http://192.168.1.20/a.jpg"))
    assert.ok(unreachableByMeta("http://10.0.0.5/a.jpg"))
    assert.ok(unreachableByMeta("http://172.16.0.9/a.jpg"))
    assert.ok(unreachableByMeta("http://127.0.0.1:3000/a.jpg"))
  })

  it("rejects a non-http scheme", () => {
    assert.match(unreachableByMeta("file:///tmp/a.jpg")!, /unsupported scheme/)
  })

  it("rejects garbage", () => {
    assert.match(unreachableByMeta("not a url")!, /not a valid URL/)
  })
})

describe("isPrivateHostname", () => {
  it("treats public hosts as reachable", () => {
    assert.equal(isPrivateHostname("cdn.example.com"), false)
    assert.equal(isPrivateHostname("mydorahotel.com"), false)
  })

  it("catches local suffixes and IPv6 local ranges", () => {
    assert.equal(isPrivateHostname("api.localhost"), true)
    assert.equal(isPrivateHostname("db.internal"), true)
    assert.equal(isPrivateHostname("printer.local"), true)
    assert.equal(isPrivateHostname("[::1]"), true)
    assert.equal(isPrivateHostname("fd00:1234::1"), true)
  })
})
