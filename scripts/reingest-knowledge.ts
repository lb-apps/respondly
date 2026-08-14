/**
 * One-shot CLI: re-chunk + re-embed all ready knowledge sources.
 * Usage: npx tsx scripts/reingest-knowledge.ts [--orgId=<uuid>]
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

async function main() {
  loadEnvLocal()

  const { createClient } = await import("@supabase/supabase-js")
  const ws = (await import("ws")).default
  const { reingestAllReadySources } = await import(
    "../src/lib/knowledge/reingest-all"
  )

  const orgArg = process.argv.find((a) => a.startsWith("--orgId="))
  const orgId = orgArg?.split("=")[1]

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws as unknown as typeof WebSocket },
    }
  )

  const result = await reingestAllReadySources(supabase, {
    batchSize: 25,
    orgId,
  })

  console.log(
    `Done. processed=${result.processed} ok=${result.succeeded} failed=${result.failed}`
  )

  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.error(`  source ${e.sourceId}: ${e.error}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
