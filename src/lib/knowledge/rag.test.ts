import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  chunkContent,
  chunkText,
  splitOnHardBoundaries,
} from "@/lib/knowledge/chunk"

const FAQ_SAMPLE = `
Genel Bilgiler

Otelimiz şehir merkezine 2 km mesafededir.

**S: Otopark var mı?**
C: Evet, misafirlerimiz için ücretsiz açık otoparkımız bulunmaktadır.

**S: Check-in saati kaçtır?**
C: Check-in saati 14:00, check-out saati 12:00'dır.

## Fiyatlandırma

Standart oda gecelik fiyatları sezona göre değişir.
`.trim()

describe("chunkContent FAQ boundaries", () => {
  it("isolates Turkish FAQ questions into separate sections", () => {
    const sections = splitOnHardBoundaries(FAQ_SAMPLE)
    const parking = sections.find((s) => s.includes("Otopark"))
    const checkin = sections.find((s) => s.includes("Check-in"))
    assert.ok(parking, "parking FAQ section exists")
    assert.ok(checkin, "check-in FAQ section exists")
    assert.ok(
      !parking!.includes("Check-in"),
      "parking chunk must not include check-in FAQ"
    )
  })

  it("chunkText legacy helper preserves FAQ isolation", () => {
    const chunks = chunkText(FAQ_SAMPLE)
    const parking = chunks.find((c) => c.includes("Otopark"))
    assert.ok(parking)
    assert.ok(!parking!.includes("Check-in"))
  })

  it("chunkContent text kind keeps FAQ questions in separate chunks", async () => {
    const chunks = await chunkContent(FAQ_SAMPLE, { kind: "text" })
    const parking = chunks.find((c) => c.includes("Otopark"))
    assert.ok(parking)
    assert.ok(!parking!.includes("Check-in"))
  })

  it("chunkContent link kind returns non-empty markdown chunks", async () => {
    const md = `# Otopark\n\nÜcretsiz otopark vardır.\n\n## Havuz\n\nAçık havuz mevcuttur.`
    const chunks = await chunkContent(md, { kind: "link" })
    assert.ok(chunks.length >= 1)
    assert.ok(chunks.some((c) => c.includes("Otopark")))
  })
})

describe("rerank fail-open", () => {
  it("maps QueryResult ids back to RetrievedChunk shape", async () => {
    const { rerankChunks } = await import("@/lib/knowledge/rerank")
    const chunks = [
      {
        id: "a",
        sourceId: "s1",
        content: "Otopark ücretsizdir.",
        similarity: 0.35,
        imageUrl: null,
      },
      {
        id: "b",
        sourceId: "s1",
        content: "Havuz açıktır.",
        similarity: 0.33,
        imageUrl: null,
      },
    ]

    // Without OPENROUTER_API_KEY rerank fails open to vector order.
    const out = await rerankChunks("Otopark var mı?", chunks, 1)
    assert.equal(out.length, 1)
    assert.equal(out[0]!.id, "a")
    assert.equal(out[0]!.similarity, 0.35)
  })
})
