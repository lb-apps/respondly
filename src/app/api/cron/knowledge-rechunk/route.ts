import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { reingestAllReadySources } from "@/lib/knowledge/reingest-all"

/**
 * Batch re-chunk + re-embed ready knowledge sources after chunking upgrades.
 * Guarded by CRON_SECRET. Processes each ready source at most once per call.
 *
 * Optional query: `?orgId=<uuid>` to scope to one organization.
 */
export const runtime = "nodejs"
export const maxDuration = 60

const BATCH = 25

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const orgId = url.searchParams.get("orgId") ?? undefined

  const supabase = createAdminClient()
  const result = await reingestAllReadySources(supabase, {
    batchSize: BATCH,
    orgId,
  })

  return NextResponse.json({ ok: true, ...result })
}
