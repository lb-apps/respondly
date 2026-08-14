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
 * Auto Refresh / Auto Remove cron for link knowledge sources.
 *
 * Triggered daily by the Supabase pg_cron job (net.http_post → here) with
 * `Authorization: Bearer ${CRON_SECRET}`. The system, not a user, drives this,
 * so it runs under the service-role client (bypasses RLS to scan every org).
 *
 * Per due source (auto_refresh=true, stale > 7d):
 *  - auto_remove + URL now 404s → delete the source (chunks cascade).
 *  - else re-ingest from stored crawl_config, bump last_refreshed_at.
 * Quota re-checked on refresh; an over-quota refresh marks the source failed
 * (Turkish error) rather than evicting other sources.
 */

// Node runtime (uses node:crypto + crawl/extract Node deps).
export const runtime = "nodejs"
export const maxDuration = 60

const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
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

/** HEAD/GET the URL to decide if it 404s (auto-remove trigger). */
async function isGone(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" })
    if (res.status === 404 || res.status === 410) return true
    // Some servers reject HEAD — confirm with a lightweight GET.
    if (res.status === 405) {
      const g = await fetch(url, { method: "GET", redirect: "follow" })
      return g.status === 404 || g.status === 410
    }
    return false
  } catch {
    // Network error is not a definitive 404 — keep the source.
    return false
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - REFRESH_INTERVAL_MS).toISOString()

  // Due = auto_refresh link sources never refreshed or refreshed > 7d ago.
  const { data: due, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("kind", "link")
    .eq("auto_refresh", true)
    .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${cutoff}`)
    .order("last_refreshed_at", { ascending: true, nullsFirst: true })
    .limit(BATCH)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let refreshed = 0
  let removed = 0
  let failed = 0

  for (const src of due ?? []) {
    // Auto Remove: drop the source if its URL is gone.
    if (src.auto_remove && src.raw_ref && (await isGone(src.raw_ref))) {
      await supabase.from("knowledge_sources").delete().eq("id", src.id)
      removed++
      continue
    }

    await supabase
      .from("knowledge_sources")
      .update({ status: "processing", error: null })
      .eq("id", src.id)

    const result = await ingestSource(supabase, src)

    if (!result.ok) {
      failed++
      // ingestSource already marked it failed; still bump timestamp to avoid a
      // hot-retry loop on every cron tick.
      await supabase
        .from("knowledge_sources")
        .update({ last_refreshed_at: new Date().toISOString() })
        .eq("id", src.id)
      continue
    }

    // Re-check quota after the (possibly larger) re-crawl.
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

      await supabase
        .from("knowledge_sources")
        .update({ last_refreshed_at: new Date().toISOString() })
        .eq("id", src.id)
      refreshed++
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
          last_refreshed_at: new Date().toISOString(),
        })
        .eq("id", src.id)
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    processed: due?.length ?? 0,
    refreshed,
    removed,
    failed,
  })
}
