import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { embedQuery, toVectorLiteral } from "@/mastra/embeddings"
import { rerankChunks } from "@/lib/knowledge/rerank"
import type { RetrievedChunk } from "@/lib/knowledge/types"

type DB = SupabaseClient<Database>

/** Vector candidates fetched before reranking. */
const CANDIDATE_COUNT = 24
/** Final passages returned to the assistant tool. */
const FINAL_TOP_K = 8

export type { RetrievedChunk } from "@/lib/knowledge/types"

/**
 * RAG retrieval: embed the query, fetch nearest knowledge chunks for the org.
 * RLS scopes results to the caller's org; passing org/assistant ids narrows
 * further. Returns [] when nothing is relevant — caller MUST treat empty as
 * "no grounding" and hand off rather than guess.
 */
export async function retrieveChunks(
  supabase: DB,
  params: {
    orgId: string
    assistantId: string | null
    query: string
    matchCount?: number
    minSimilarity?: number
  }
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(params.query)

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    p_org_id: params.orgId,
    p_assistant_id: params.assistantId as string,
    p_query_embedding: toVectorLiteral(embedding),
    // k=8 + a 0.22 floor: text-embedding-3-small has a compressed dynamic
    // range on short Turkish queries (relevant passages land ~0.30–0.45, noise
    // ~0.20–0.30), so a high floor like 0.35 silently dropped real answers
    // (e.g. "Otopark var mı?" → its chunk scored 0.35). Retrieve a few more and
    // let the LLM pick the relevant passage; the tool caps each to 600 chars.
    p_match_count: params.matchCount ?? CANDIDATE_COUNT,
    p_min_similarity: params.minSimilarity ?? 0.22,
  })

  if (error) {
    // Surface misconfig (e.g. missing service-role key) instead of silently
    // returning no grounding, which looks like "RAG too weak".
    console.error("[retrieveChunks] match_knowledge_chunks failed:", error.message)
    return []
  }

  if (!data) return []

  const candidates: RetrievedChunk[] = data.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    content: r.content,
    similarity: r.similarity,
    imageUrl: r.image_url ?? null,
  }))

  return rerankChunks(params.query, candidates, FINAL_TOP_K)
}
