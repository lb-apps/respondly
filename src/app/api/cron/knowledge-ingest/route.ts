import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { ingestSource } from "@/lib/knowledge/ingest"
import {
  assertWithinQuota,
  getOrgQuota,
  getUsedBytes,
  QuotaExceededError,
} from "@/lib/knowledge/quota"

/**
 * Safety-net sweep for stuck knowledge ingests.
 *
 * Source indexing normally runs in the background via Next.js `after()` right
 * after the create/edit server action returns. If that callback is cut off
 * (e.g. the serverless function hits its time budget on a large file), the row
 * is left in `status='processing'` forever. This sweep — triggered every couple
 * of minutes by the Supabase pg_cron job — re-runs `ingestSource` for any row
 * stuck in `processing` past a grace window, so it eventually reaches
 * ready/failed. Idempotent: a row that finished is no longer `processing`.
 *
 * Guarded by `Authorization: Bearer ${CRON_SECRET}` and runs under the
 * service-role client (the system, not a user, drives it).
 */

// Node runtime (uses node:crypto + crawl/extract Node deps).
export const runtime = "nodejs"
export const maxDuration = 60

// Only recover rows that have been "processing" longer than this — avoids
// racing with an in-flight `after()` ingest that just started.
const STUCK_AFTER_MS = 10 * 60 * 1000
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

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString()

  const { data: stuck, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(BATCH)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let recovered = 0
  let failed = 0

  for (const src of stuck ?? []) {
    const result = await ingestSource(supabase, src)
    if (!result.ok) {
      // ingestSource already marked it failed (with a fresh updated_at).
      failed++
      continue
    }

    // Link size is only known after the crawl — re-check quota, evicting this
    // source (not others) if it pushed the org over.
    if (src.kind === "link") {
      try {
        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", src.organization_id)
          .single()
        const quota = getOrgQuota({ settings: org?.settings ?? {} })
        const used = await getUsedBytes(supabase, src.organization_id)
        const { data: cur } = await supabase
          .from("knowledge_sources")
          .select("size_bytes")
          .eq("id", src.id)
          .single()
        const size = cur?.size_bytes ?? 0
        assertWithinQuota(Math.max(0, used - size), size, quota)
      } catch (e) {
        const message =
          e instanceof QuotaExceededError ? e.message : "Yenileme kota hatası"
        await supabase.from("knowledge_chunks").delete().eq("source_id", src.id)
        await supabase
          .from("knowledge_sources")
          .update({
            status: "failed",
            error: message,
            size_bytes: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", src.id)
        failed++
        continue
      }
    }

    recovered++
  }

  return NextResponse.json({
    ok: true,
    processed: stuck?.length ?? 0,
    recovered,
    failed,
  })
}
