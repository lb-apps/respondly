export interface RetrievedChunk {
  id: string
  sourceId: string
  content: string
  similarity: number
  imageUrl: string | null
  /** Present when Mastra reranker reordered results. */
  rerankScore?: number
}
