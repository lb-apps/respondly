import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, KnowledgeSource } from "@/types/database"
import { ingestSource } from "@/lib/knowledge/ingest"

type DB = SupabaseClient<Database>

type ReingestSource = Pick<
  KnowledgeSource,
  | "id"
  | "organization_id"
  | "assistant_id"
  | "kind"
  | "raw_ref"
  | "content"
  | "file_ext"
  | "crawl_config"
>

export type ReingestAllResult = {
  processed: number
  succeeded: number
  failed: number
  errors: Array<{ sourceId: string; error: string }>
}

async function listReadySourceIds(
  supabase: DB,
  orgId?: string
): Promise<string[]> {
  let query = supabase
    .from("knowledge_sources")
    .select("id")
    .eq("status", "ready")
    .order("updated_at", { ascending: true })

  if (orgId) {
    query = query.eq("organization_id", orgId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.id)
}

async function fetchSource(
  supabase: DB,
  id: string
): Promise<ReingestSource | null> {
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select(
      "id, organization_id, assistant_id, kind, raw_ref, content, file_ext, crawl_config"
    )
    .eq("id", id)
    .single()

  if (error || !data) return null
  return data as ReingestSource
}

/**
 * Re-chunk and re-embed all ready knowledge sources (one-time migration helper
 * after chunking strategy changes). Each source is processed at most once per
 * call — IDs are collected upfront so re-ready rows are not re-queued.
 */
export async function reingestAllReadySources(
  supabase: DB,
  opts?: { batchSize?: number; orgId?: string; sourceIds?: string[] }
): Promise<ReingestAllResult> {
  const batchSize = opts?.batchSize ?? 25
  const result: ReingestAllResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  }

  const allIds =
    opts?.sourceIds ?? (await listReadySourceIds(supabase, opts?.orgId))

  for (let i = 0; i < allIds.length; i += batchSize) {
    const batch = allIds.slice(i, i + batchSize)

    for (const id of batch) {
      const src = await fetchSource(supabase, id)
      if (!src) continue

      result.processed++

      await supabase
        .from("knowledge_sources")
        .update({
          status: "processing",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", src.id)

      const ingest = await ingestSource(supabase, src)
      if (ingest.ok) {
        result.succeeded++
      } else {
        result.failed++
        result.errors.push({ sourceId: src.id, error: ingest.error })
      }
    }
  }

  return result
}
