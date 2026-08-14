import { embed, embedMany } from "ai"
import { openrouter } from "@/mastra/openrouter"

/** OpenRouter embedding model. 1536 dims — must match knowledge_chunks.embedding. */
export const EMBEDDING_MODEL = "openai/text-embedding-3-small"
export const EMBEDDING_DIM = 1536

function model() {
  return openrouter.textEmbeddingModel(EMBEDDING_MODEL)
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: model(), value: text })
  return embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const { embeddings } = await embedMany({ model: model(), values: texts })
  return embeddings
}

/** pgvector text literal, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`
}
