import type { SupabaseClient } from "@supabase/supabase-js"
import type { CrawlConfig, Database, KnowledgeSource } from "@/types/database"
import { chunkContent } from "@/lib/knowledge/chunk"
import { extractFileText, extractLinkText } from "@/lib/knowledge/extract"
import { embedBatch, toVectorLiteral } from "@/mastra/embeddings"
import { KNOWLEDGE_BUCKET, KNOWLEDGE_IMAGE_BUCKET } from "@/lib/knowledge/constants"

type DB = SupabaseClient<Database>

export { KNOWLEDGE_BUCKET }

type IngestSource = Pick<
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

async function resolveText(supabase: DB, source: IngestSource): Promise<string> {
  switch (source.kind) {
    case "text":
      return (source.content ?? "").trim()
    case "image":
      // For image sources the user writes the description manually; embed it.
      return (source.content ?? "").trim()
    case "link": {
      if (!source.raw_ref) throw new Error("Bağlantı adresi eksik")
      const opts = (source.crawl_config ?? undefined) as CrawlConfig | undefined
      return extractLinkText(source.raw_ref, opts)
    }
    case "file": {
      if (!source.raw_ref) throw new Error("Dosya yolu eksik")
      if (!source.file_ext) throw new Error("Dosya türü eksik")
      const { data, error } = await supabase.storage
        .from(KNOWLEDGE_BUCKET)
        .download(source.raw_ref)
      if (error || !data) throw new Error("Dosya indirilemedi")
      const buf = new Uint8Array(await data.arrayBuffer())
      return extractFileText(buf, source.file_ext)
    }
    default:
      throw new Error(`Bilinmeyen kaynak türü: ${source.kind}`)
  }
}

type IngestResult = { ok: true; chunks: number } | { ok: false; error: string }

/**
 * Chunk → embed → replace chunks → mark ready. Shared by extract-based ingest
 * and content-edit re-ingest. Updates size_bytes (UTF-8 byte length of the
 * indexed text) so the storage quota reflects link/text growth on re-ingest.
 *
 * @param imageUrl When set, every chunk for this source carries the image URL
 *   so the agent can surface it alongside the matched passage.
 */
async function chunkEmbedStore(
  supabase: DB,
  source: Pick<IngestSource, "id" | "organization_id" | "assistant_id" | "kind">,
  text: string,
  opts?: { imageUrl?: string; preserveSize?: boolean }
): Promise<IngestResult> {
  const chunks = await chunkContent(text, { kind: source.kind })
  if (chunks.length === 0) throw new Error("İçerik bölümlenemedi")

  const embeddings = await embedBatch(chunks)

  // Replace any prior chunks for this source (re-ingest safe).
  await supabase.from("knowledge_chunks").delete().eq("source_id", source.id)

  const rows = chunks.map((content, i) => ({
    organization_id: source.organization_id,
    source_id: source.id,
    assistant_id: source.assistant_id,
    content,
    embedding: toVectorLiteral(embeddings[i]),
    chunk_index: i,
    token_count: Math.ceil(content.length / 4),
    image_url: opts?.imageUrl ?? null,
  }))

  const { error: insErr } = await supabase.from("knowledge_chunks").insert(rows)
  if (insErr) throw new Error(insErr.message)

  // Media sources meter by uploaded file size (set at creation) — don't
  // overwrite size_bytes with the (tiny) description's text length.
  await supabase
    .from("knowledge_sources")
    .update({
      status: "ready",
      error: null,
      content: text.slice(0, 100000),
      ...(opts?.preserveSize
        ? {}
        : { size_bytes: Buffer.byteLength(text, "utf8") }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", source.id)

  return { ok: true, chunks: chunks.length }
}

async function markFailed(supabase: DB, id: string, message: string): Promise<void> {
  await supabase
    .from("knowledge_sources")
    .update({
      status: "failed",
      error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
}

/**
 * Process a knowledge source: extract → chunk → embed → store chunks.
 * Updates source.status to 'ready' or 'failed'. Runs under the caller's RLS
 * context (knowledge.access enforced on writes).
 *
 * For image sources the public URL is derived from the storage path in raw_ref
 * and stamped on every chunk so the agent can surface the photo alongside its
 * description passage.
 */
export async function ingestSource(
  supabase: DB,
  source: IngestSource
): Promise<IngestResult> {
  try {
    const text = await resolveText(supabase, source)
    if (!text || text.length < 20) {
      throw new Error(
        "Metin çıkarılamadı. Taranmış (görsel) PDF olabilir — metin tabanlı bir dosya deneyin."
      )
    }

    let imageUrl: string | undefined
    if (source.kind === "image" && source.raw_ref) {
      const { data } = supabase.storage
        .from(KNOWLEDGE_IMAGE_BUCKET)
        .getPublicUrl(source.raw_ref)
      imageUrl = data.publicUrl
    }

    return await chunkEmbedStore(supabase, source, text, {
      imageUrl,
      preserveSize: source.kind === "image",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "İşleme hatası"
    await markFailed(supabase, source.id, message)
    return { ok: false, error: message }
  }
}

/**
 * Re-index a source from already-extracted text (no fetch/parse). Used by the
 * Detail-sheet content edit and text-source edit: the caller supplies the new
 * content, we re-chunk + re-embed straight from it.
 */
export async function reingestFromContent(
  supabase: DB,
  source: Pick<IngestSource, "id" | "organization_id" | "assistant_id" | "kind">,
  text: string
): Promise<IngestResult> {
  try {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 20) {
      throw new Error("İçerik çok kısa — en az 20 karakter olmalı")
    }
    return await chunkEmbedStore(supabase, source, trimmed)
  } catch (e) {
    const message = e instanceof Error ? e.message : "İşleme hatası"
    await markFailed(supabase, source.id, message)
    return { ok: false, error: message }
  }
}
