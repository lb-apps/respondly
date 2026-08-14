import type { MastraLanguageModel } from "@mastra/core/agent"
import type { QueryResult } from "@mastra/core/vector"
import {
  MastraAgentRelevanceScorer,
  rerankWithScorer,
} from "@mastra/rag"
import { openrouter } from "@/mastra/openrouter"
import type { RetrievedChunk } from "@/lib/knowledge/types"

/** Fast/cheap model for reranking — keeps WhatsApp turn latency low. */
const RERANK_MODEL = "google/gemini-2.5-flash"

const DEFAULT_WEIGHTS = {
  semantic: 0.5,
  vector: 0.3,
  position: 0.2,
} as const

let scorer: MastraAgentRelevanceScorer | null = null

function getScorer(): MastraAgentRelevanceScorer {
  if (!scorer) {
    scorer = new MastraAgentRelevanceScorer(
      "knowledge-rerank",
      openrouter.chat(RERANK_MODEL) as unknown as MastraLanguageModel
    )
  }
  return scorer
}

function toQueryResults(chunks: RetrievedChunk[]): QueryResult[] {
  return chunks.map((c, index) => ({
    id: c.id,
    score: c.similarity,
    metadata: {
      text: c.content,
      sourceId: c.sourceId,
      imageUrl: c.imageUrl,
      chunkIndex: index,
    },
  }))
}

/**
 * Re-rank vector-search candidates with Mastra's cross-attention scorer.
 * Fail-open: on error, returns the original vector ordering (truncated to topK).
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topK = 8
): Promise<RetrievedChunk[]> {
  if (chunks.length <= 1) return chunks.slice(0, topK)

  try {
    const reranked = await rerankWithScorer({
      results: toQueryResults(chunks),
      query,
      scorer: getScorer(),
      options: {
        weights: DEFAULT_WEIGHTS,
        topK,
      },
    })

    const byId = new Map(chunks.map((c) => [c.id, c]))

    return reranked
      .map((r) => {
        const original = byId.get(r.result.id)
        if (!original) return null
        return {
          ...original,
          rerankScore: r.score,
        }
      })
      .filter((c): c is RetrievedChunk & { rerankScore: number } => c !== null)
      .slice(0, topK)
  } catch (err) {
    console.error("[rerankChunks] rerank failed, using vector order:", err)
    return chunks.slice(0, topK)
  }
}
