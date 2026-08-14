/**
 * Optional integration check: measures rerank latency with live OpenRouter.
 * Skips when OPENROUTER_API_KEY is unset.
 *
 * Usage: npx tsx scripts/verify-rag-rerank.ts
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = value
  }
}

const QUERIES = [
  "Otopark var mı?",
  "Check-in saati kaç?",
  "Fiyatlar ne kadar?",
  "Havuz açık mı?",
]

async function main() {
  loadEnvLocal()

  if (!process.env.OPENROUTER_API_KEY) {
    console.log("SKIP: OPENROUTER_API_KEY not set — rerank latency check skipped")
    return
  }

  const { rerankChunks } = await import("../src/lib/knowledge/rerank")

  const candidates = [
    {
      id: "1",
      sourceId: "s",
      content: "Misafirlerimiz için ücretsiz açık otoparkımız bulunmaktadır.",
      similarity: 0.31,
      imageUrl: null,
    },
    {
      id: "2",
      sourceId: "s",
      content: "Check-in saati 14:00, check-out 12:00'dır.",
      similarity: 0.33,
      imageUrl: null,
    },
    {
      id: "3",
      sourceId: "s",
      content: "Açık havuz yaz sezonunda 08:00-20:00 arası hizmet verir.",
      similarity: 0.29,
      imageUrl: null,
    },
  ]

  for (const query of QUERIES) {
    const start = performance.now()
    const out = await rerankChunks(query, candidates, 2)
    const ms = Math.round(performance.now() - start)
    console.log(
      `[${ms}ms] "${query}" → top: ${out.map((c) => c.content.slice(0, 50)).join(" | ")}`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
