"use server"

import { z } from "zod"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  ingestSource,
  reingestFromContent,
  KNOWLEDGE_BUCKET,
} from "@/lib/knowledge/ingest"
import {
  assertWithinQuota,
  getMediaUsedBytes,
  getOrgMediaQuota,
  formatBytes,
  getOrgQuota,
  getUsedBytes,
  QuotaExceededError,
} from "@/lib/knowledge/quota"
import { KNOWLEDGE_FILE_MAX_BYTES } from "@/lib/knowledge/file-upload"
import { isSupportedFileExt } from "@/lib/knowledge/extract"
import { IMAGE_MAX_BYTES, KNOWLEDGE_IMAGE_EXTENSIONS, KNOWLEDGE_IMAGE_BUCKET } from "@/lib/knowledge/constants"
import { getSourceDetail, type SourceDetail } from "@/lib/supabase/queries/knowledge"
import type {
  CrawlConfig,
  KnowledgeSource,
  KnowledgeSourceInsert,
} from "@/types/database"

export type ActionResult =
  | { ok: true; sourceId: string; chunks?: number }
  | { ok: false; error: string }

export type SimpleResult = { ok: true } | { ok: false; error: string }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, user }
}

type DB = Awaited<ReturnType<typeof createClient>>

/**
 * Throw QuotaExceededError if adding `incoming` bytes pushes the org over quota.
 * `excludeSourceId` removes a source's current size from the used total so a
 * re-ingest/edit of an existing source nets only its delta.
 */
async function assertQuota(
  supabase: DB,
  orgId: string,
  incoming: number,
  excludeSourceId?: string
): Promise<void> {
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single()
  const quota = getOrgQuota({ settings: org?.settings ?? {} })
  let used = await getUsedBytes(supabase, orgId)
  if (excludeSourceId) {
    const { data: prev } = await supabase
      .from("knowledge_sources")
      .select("size_bytes")
      .eq("id", excludeSourceId)
      .single()
    used -= prev?.size_bytes ?? 0
  }
  assertWithinQuota(Math.max(0, used), incoming, quota)
}

/** Media quota check: incoming raw image bytes against the org's media allowance. */
async function assertMediaQuota(
  supabase: DB,
  orgId: string,
  incoming: number
): Promise<void> {
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single()
  const quota = getOrgMediaQuota({ settings: org?.settings ?? {} })
  const used = await getMediaUsedBytes(supabase, orgId)
  assertWithinQuota(Math.max(0, used), incoming, quota)
}

function quotaError(e: unknown): { ok: false; error: string } | null {
  if (e instanceof QuotaExceededError) return { ok: false, error: e.message }
  return null
}

/**
 * Folders, moves, renames and deletes can span either surface (Knowledge docs or
 * Medya albums), so revalidate both — cheap, and avoids a stale list after a
 * cross-category-agnostic mutation.
 */
function revalidateKnowledgeSurfaces(slug: string): void {
  revalidatePath(`/${slug}/knowledge`)
  revalidatePath(`/${slug}/media`)
}

/**
 * Run the slow extract → embed → store ingest in the background, after the
 * server action's response has been sent (Next.js `after()`). The UI gets an
 * instant "processing" row and learns it's ready via Realtime.
 *
 * Uses the service-role client on purpose: the request's RLS/cookie scope is
 * gone once we return, and org ownership was already enforced under the
 * caller's RLS at insert — same system-driven trust model as the refresh cron.
 *
 * For link sources, size is only known after the crawl, so quota is re-checked
 * here and *this* source (never others) is evicted if it pushed the org over.
 */
function scheduleIngest(
  source: KnowledgeSource,
  opts?: { enforceQuotaAfterIngest?: boolean }
): void {
  after(async () => {
    const admin = createAdminClient()
    const result = await ingestSource(admin, source)
    if (!result.ok || !opts?.enforceQuotaAfterIngest) return

    try {
      const { data: org } = await admin
        .from("organizations")
        .select("settings")
        .eq("id", source.organization_id)
        .single()
      const quota = getOrgQuota({ settings: org?.settings ?? {} })
      const used = await getUsedBytes(admin, source.organization_id)
      const { data: cur } = await admin
        .from("knowledge_sources")
        .select("size_bytes")
        .eq("id", source.id)
        .single()
      const size = cur?.size_bytes ?? 0
      assertWithinQuota(Math.max(0, used - size), size, quota)
    } catch (e) {
      const message =
        e instanceof QuotaExceededError ? e.message : "Kota kontrolü başarısız"
      await admin.from("knowledge_chunks").delete().eq("source_id", source.id)
      await admin
        .from("knowledge_sources")
        .update({
          status: "failed",
          error: message,
          size_bytes: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", source.id)
    }
  })
}

async function createAndIngest(
  row: KnowledgeSourceInsert,
  slug: string,
  opts?: { enforceQuotaAfterIngest?: boolean }
): Promise<ActionResult> {
  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  const { data, error } = await ctx.supabase
    .from("knowledge_sources")
    .insert({ ...row, created_by: ctx.user.id, status: "processing" })
    .select("*")
    .single()
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Kaynak oluşturulamadı" }
  }

  // Index in the background; return immediately so the dialog closes fast.
  scheduleIngest(data, opts)
  // Media lives on its own page; reference sources on Knowledge. Revalidate the
  // surface this row belongs to.
  revalidatePath(`/${slug}/${data.category === "media" ? "media" : "knowledge"}`)
  return { ok: true, sourceId: data.id }
}

// ── Sources ────────────────────────────────────────────────────────────────

const textSchema = z.object({
  organizationId: z.string().uuid(),
  assistantId: z.string().uuid().nullable(),
  slug: z.string().min(1),
  folderId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Başlık gerekli").max(160),
  content: z.string().trim().min(20, "En az 20 karakter metin gerekli"),
})

export async function createTextSource(
  input: z.input<typeof textSchema>
): Promise<ActionResult> {
  const p = textSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }
  try {
    await assertQuota(
      ctx.supabase,
      p.data.organizationId,
      Buffer.byteLength(p.data.content, "utf8")
    )
  } catch (e) {
    return quotaError(e) ?? { ok: false, error: "Kota kontrolü başarısız" }
  }

  return createAndIngest(
    {
      organization_id: p.data.organizationId,
      assistant_id: p.data.assistantId,
      folder_id: p.data.folderId ?? null,
      kind: "text",
      title: p.data.title,
      content: p.data.content,
    },
    p.data.slug
  )
}

const crawlConfigSchema = z.object({
  mode: z.enum(["single", "sitemap", "whole"]),
  depth: z.number().int().min(0).max(5).optional(),
  maxUrls: z.number().int().min(1).max(10_000).optional(),
  pattern: z.string().trim().max(200).optional(),
})

const linkSchema = z.object({
  organizationId: z.string().uuid(),
  assistantId: z.string().uuid().nullable(),
  slug: z.string().min(1),
  folderId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Başlık gerekli").max(160),
  url: z.string().trim().url("Geçerli bir bağlantı gerekli"),
  crawlConfig: crawlConfigSchema.optional(),
  autoRefresh: z.boolean().optional(),
  autoRemove: z.boolean().optional(),
})

export async function createLinkSource(
  input: z.input<typeof linkSchema>
): Promise<ActionResult> {
  const p = linkSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  return createAndIngest(
    {
      organization_id: p.data.organizationId,
      assistant_id: p.data.assistantId,
      folder_id: p.data.folderId ?? null,
      kind: "link",
      title: p.data.title,
      raw_ref: p.data.url,
      crawl_config: (p.data.crawlConfig ?? { mode: "whole" }) as CrawlConfig,
      auto_refresh: p.data.autoRefresh ?? false,
      auto_remove: p.data.autoRemove ?? false,
    },
    p.data.slug,
    { enforceQuotaAfterIngest: true }
  )
}

const fileSchema = z.object({
  organizationId: z.string().uuid(),
  assistantId: z.string().uuid().nullable(),
  slug: z.string().min(1),
  folderId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Başlık gerekli").max(160),
  // storage path: must live under the org's folder ({orgId}/...)
  storagePath: z.string().trim().min(1),
  fileExt: z.string().trim().min(1).max(10),
  mimeType: z.string().trim().max(160).nullable().optional(),
  sizeBytes: z.number().int().min(0),
})

export async function createFileSource(
  input: z.input<typeof fileSchema>
): Promise<ActionResult> {
  const p = fileSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }
  if (!p.data.storagePath.startsWith(`${p.data.organizationId}/`)) {
    return { ok: false, error: "Geçersiz dosya yolu" }
  }
  const ext = p.data.fileExt.toLowerCase()
  if (!isSupportedFileExt(ext)) {
    return { ok: false, error: `Desteklenmeyen dosya türü: ${ext}` }
  }

  if (p.data.sizeBytes > KNOWLEDGE_FILE_MAX_BYTES) {
    return {
      ok: false,
      error: `Dosya çok büyük (en fazla ${formatBytes(KNOWLEDGE_FILE_MAX_BYTES)}).`,
    }
  }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  // Quota is metered on *extracted text*, known only after ingest — so the
  // file follows the same path as a link: insert provisionally (size 0), then
  // re-check the indexed-text size in the background and evict *this* source if
  // it pushed the org over. The raw upload size is just the coarse cap above.
  return createAndIngest(
    {
      organization_id: p.data.organizationId,
      assistant_id: p.data.assistantId,
      folder_id: p.data.folderId ?? null,
      kind: "file",
      title: p.data.title,
      raw_ref: p.data.storagePath,
      file_ext: ext,
      mime_type: p.data.mimeType ?? null,
      size_bytes: 0,
    },
    p.data.slug,
    { enforceQuotaAfterIngest: true }
  )
}

const imageSourceSchema = z.object({
  organizationId: z.string().uuid(),
  assistantId: z.string().uuid().nullable(),
  slug: z.string().min(1),
  folderId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Başlık gerekli").max(160),
  description: z.string().trim().min(20, "Açıklama en az 20 karakter olmalı"),
  storagePath: z.string().trim().min(1),
  mimeType: z.string().trim().max(160).nullable().optional(),
  sizeBytes: z.number().int().min(0),
})

/**
 * Create a knowledge source from an uploaded image. The user-written description
 * is embedded and the image public URL is stored on every chunk so the agent can
 * surface the photo alongside a matched passage.
 *
 * Media is metered on raw file size (not extracted text): `size_bytes` holds the
 * uploaded image size, counted against the org's media quota. The per-file cap
 * (IMAGE_MAX_BYTES) and the org media quota are both enforced synchronously.
 */
export async function createImageSource(
  input: z.input<typeof imageSourceSchema>
): Promise<ActionResult> {
  const p = imageSourceSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  if (!p.data.storagePath.startsWith(`${p.data.organizationId}/`)) {
    return { ok: false, error: "Geçersiz dosya yolu" }
  }
  const ext = p.data.storagePath.split(".").pop()?.toLowerCase() ?? ""
  if (!(KNOWLEDGE_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, error: `Desteklenmeyen görsel türü: ${ext}` }
  }
  if (p.data.sizeBytes > IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Görsel çok büyük (en fazla ${formatBytes(IMAGE_MAX_BYTES)}).`,
    }
  }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }
  try {
    await assertMediaQuota(ctx.supabase, p.data.organizationId, p.data.sizeBytes)
  } catch (e) {
    return quotaError(e) ?? { ok: false, error: "Kota kontrolü başarısız" }
  }

  return createAndIngest(
    {
      organization_id: p.data.organizationId,
      assistant_id: p.data.assistantId,
      folder_id: p.data.folderId ?? null,
      kind: "image",
      category: "media",
      title: p.data.title,
      content: p.data.description,
      raw_ref: p.data.storagePath,
      mime_type: p.data.mimeType ?? null,
      size_bytes: p.data.sizeBytes,
    },
    p.data.slug
  )
}

export async function reingestSource(
  sourceId: string,
  slug: string
): Promise<ActionResult> {
  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  const { data, error } = await ctx.supabase
    .from("knowledge_sources")
    .update({
      status: "processing",
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sourceId)
    .select("*")
    .single()
  if (error || !data) return { ok: false, error: "Kaynak bulunamadı" }

  // Link re-ingest may grow past quota — re-check + evict-self in background.
  scheduleIngest(data, { enforceQuotaAfterIngest: data.kind === "link" })
  revalidatePath(`/${slug}/knowledge`)
  return { ok: true, sourceId }
}

const replaceFileSchema = z.object({
  sourceId: z.string().uuid(),
  slug: z.string().min(1),
  storagePath: z.string().trim().min(1),
  fileExt: z.string().trim().min(1).max(10),
  mimeType: z.string().trim().max(160).nullable().optional(),
  sizeBytes: z.number().int().min(0),
})

/** After client uploads to storage, re-index the file source from the new blob. */
export async function replaceFileSource(
  input: z.input<typeof replaceFileSchema>
): Promise<ActionResult> {
  const p = replaceFileSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ext = p.data.fileExt.toLowerCase()
  if (!isSupportedFileExt(ext)) {
    return { ok: false, error: `Desteklenmeyen dosya türü: ${ext}` }
  }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  const { data: src, error } = await ctx.supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", p.data.sourceId)
    .single()
  if (error || !src) return { ok: false, error: "Kaynak bulunamadı" }
  if (src.kind !== "file" || !src.raw_ref) {
    return { ok: false, error: "Bu kaynak dosya değil" }
  }
  if ((src.file_ext ?? "").toLowerCase() !== ext) {
    return { ok: false, error: `Aynı türde dosya seçin (.${src.file_ext})` }
  }
  if (p.data.storagePath !== src.raw_ref) {
    return { ok: false, error: "Geçersiz dosya yolu" }
  }
  if (!p.data.storagePath.startsWith(`${src.organization_id}/`)) {
    return { ok: false, error: "Geçersiz dosya yolu" }
  }
  if (p.data.sizeBytes > KNOWLEDGE_FILE_MAX_BYTES) {
    return {
      ok: false,
      error: `Dosya çok büyük (en fazla ${formatBytes(KNOWLEDGE_FILE_MAX_BYTES)}).`,
    }
  }

  // Reset size to 0 while reprocessing; the real extracted-text size + quota
  // re-check (evict-self on exceed) happen in the background after ingest.
  const { data: updated, error: upErr } = await ctx.supabase
    .from("knowledge_sources")
    .update({
      status: "processing",
      error: null,
      mime_type: p.data.mimeType ?? null,
      size_bytes: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", src.id)
    .select("*")
    .single()
  if (upErr || !updated) {
    return { ok: false, error: upErr?.message ?? "Kaynak güncellenemedi" }
  }

  scheduleIngest(updated, { enforceQuotaAfterIngest: true })
  revalidatePath(`/${p.data.slug}/knowledge`)
  return { ok: true, sourceId: src.id }
}

const updateContentSchema = z.object({
  sourceId: z.string().uuid(),
  slug: z.string().min(1),
  content: z.string().trim().min(20, "En az 20 karakter metin gerekli"),
})

/** Save edited content, then re-chunk + re-embed straight from it. */
export async function updateSourceContent(
  input: z.input<typeof updateContentSchema>
): Promise<ActionResult> {
  const p = updateContentSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  const { data: src, error } = await ctx.supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", p.data.sourceId)
    .single()
  if (error || !src) return { ok: false, error: "Kaynak bulunamadı" }

  try {
    await assertQuota(
      ctx.supabase,
      src.organization_id,
      Buffer.byteLength(p.data.content, "utf8"),
      src.id
    )
  } catch (e) {
    return quotaError(e) ?? { ok: false, error: "Kota kontrolü başarısız" }
  }

  await ctx.supabase
    .from("knowledge_sources")
    .update({
      status: "processing",
      error: null,
      content: p.data.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", src.id)

  // Re-chunk + re-embed from the edited content in the background.
  const content = p.data.content
  after(async () => {
    await reingestFromContent(createAdminClient(), src, content)
  })
  revalidatePath(`/${p.data.slug}/knowledge`)
  return { ok: true, sourceId: src.id }
}

export type ContentMatch = { sourceId: string; snippet: string }

const SNIPPET_MAX_LEN = 120

/** Excerpt starting at the first case-insensitive match (no leading ellipsis). */
function buildSnippet(content: string, query: string): string | null {
  const q = query.trim()
  if (q.length < 2) return null
  const clean = content.replace(/\s+/g, " ").trim()
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = clean.match(new RegExp(escaped, "iu"))
  if (match?.index === undefined) return null
  const idx = match.index
  const slice = clean.slice(idx, idx + SNIPPET_MAX_LEN)
  const suffix = idx + slice.length < clean.length ? "…" : ""
  return `${slice}${suffix}`
}

/**
 * Content search: among `sourceIds`, return each source whose stored content or
 * chunk text matches `query`, with a short excerpt around the first hit. The
 * client unions this with its own title match, so an item surfaces when the term
 * appears in its title OR its body/description. Org-scoped via RLS; restricted
 * to the current folder's sources.
 */
export async function searchSourceContent(
  organizationId: string,
  sourceIds: string[],
  query: string
): Promise<ContentMatch[]> {
  const ctx = await requireUser()
  if (!ctx) return []
  const q = query.trim()
  if (q.length < 2 || sourceIds.length === 0) return []
  // Escape ilike wildcards so user input is treated literally.
  const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
  const seen = new Set<string>()
  const out: ContentMatch[] = []

  const { data: sources } = await ctx.supabase
    .from("knowledge_sources")
    .select("id, content")
    .eq("organization_id", organizationId)
    .in("id", sourceIds)
    .ilike("content", pattern)
    .order("updated_at", { ascending: false })

  for (const row of sources ?? []) {
    const snippet = buildSnippet(row.content ?? "", q)
    if (!snippet) continue
    seen.add(row.id)
    out.push({ sourceId: row.id, snippet })
  }

  const { data } = await ctx.supabase
    .from("knowledge_chunks")
    .select("source_id, content")
    .eq("organization_id", organizationId)
    .in("source_id", sourceIds)
    .ilike("content", pattern)
    .order("chunk_index", { ascending: true })

  for (const row of data ?? []) {
    if (seen.has(row.source_id)) continue
    const snippet = buildSnippet(row.content ?? "", q)
    if (!snippet) continue
    seen.add(row.source_id)
    out.push({ sourceId: row.source_id, snippet })
  }
  return out
}

/** Load full source detail (row + chunk count + creator) for the Detail sheet. */
export async function loadSourceDetail(
  sourceId: string
): Promise<SourceDetail | null> {
  const ctx = await requireUser()
  if (!ctx) return null
  return getSourceDetail(sourceId)
}

/** Fetch full source detail for the sandbox RAG source chip. */
export async function getSourceDetailAction(
  sourceId: string
): Promise<SourceDetail | null> {
  const ctx = await requireUser()
  if (!ctx) return null
  return getSourceDetail(sourceId)
}

/** Short-lived signed URL for downloading a file source from storage. */
export async function getSignedSourceUrl(
  sourceId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }
  const { data: src } = await ctx.supabase
    .from("knowledge_sources")
    .select("kind, raw_ref")
    .eq("id", sourceId)
    .single()
  if (!src || src.kind !== "file" || !src.raw_ref) {
    return { ok: false, error: "İndirilebilir dosya yok" }
  }
  const { data, error } = await ctx.supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .createSignedUrl(src.raw_ref, 60)
  if (error || !data) return { ok: false, error: "Bağlantı oluşturulamadı" }
  return { ok: true, url: data.signedUrl }
}

// ── Folders + bulk item ops ──────────────────────────────────────────────────

const folderSchema = z.object({
  organizationId: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().trim().min(1, "Klasör adı gerekli").max(120),
  parentId: z.string().uuid().nullable().optional(),
  category: z.enum(["reference", "media"]).default("reference"),
})

export async function createFolder(
  input: z.input<typeof folderSchema>
): Promise<{ ok: true; folderId: string } | { ok: false; error: string }> {
  const p = folderSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  const { data, error } = await ctx.supabase
    .from("knowledge_folders")
    .insert({
      organization_id: p.data.organizationId,
      parent_id: p.data.parentId ?? null,
      name: p.data.name,
      category: p.data.category,
      created_by: ctx.user.id,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Klasör oluşturulamadı" }

  revalidateKnowledgeSurfaces(p.data.slug)
  return { ok: true, folderId: data.id }
}

const renameSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["folder", "source"]),
  name: z.string().trim().min(1, "Ad gerekli").max(160),
  slug: z.string().min(1),
})

export async function renameItem(
  input: z.input<typeof renameSchema>
): Promise<SimpleResult> {
  const p = renameSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  const { error } =
    p.data.kind === "folder"
      ? await ctx.supabase
          .from("knowledge_folders")
          .update({ name: p.data.name })
          .eq("id", p.data.id)
      : await ctx.supabase
          .from("knowledge_sources")
          .update({ title: p.data.name })
          .eq("id", p.data.id)
  if (error) return { ok: false, error: error.message }

  revalidateKnowledgeSurfaces(p.data.slug)
  return { ok: true }
}

const linkSettingsSchema = z.object({
  sourceId: z.string().uuid(),
  slug: z.string().min(1),
  autoRefresh: z.boolean(),
  autoRemove: z.boolean(),
})

export async function updateLinkSourceSettings(
  input: z.input<typeof linkSettingsSchema>
): Promise<SimpleResult> {
  const p = linkSettingsSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  const { error } = await ctx.supabase
    .from("knowledge_sources")
    .update({
      auto_refresh: p.data.autoRefresh,
      auto_remove: p.data.autoRemove,
    })
    .eq("id", p.data.sourceId)
    .eq("kind", "link")

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/${p.data.slug}/knowledge`)
  return { ok: true }
}

const moveSchema = z.object({
  organizationId: z.string().uuid(),
  slug: z.string().min(1),
  folderIds: z.array(z.string().uuid()).default([]),
  sourceIds: z.array(z.string().uuid()).default([]),
  targetFolderId: z.string().uuid().nullable(),
})

/** Is `candidate` inside the subtree rooted at `ancestor` (or equal)? */
function isInSubtree(
  all: Array<{ id: string; parent_id: string | null }>,
  candidate: string,
  ancestor: string
): boolean {
  const byId = new Map(all.map((f) => [f.id, f]))
  let cur: string | null = candidate
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    if (cur === ancestor) return true
    guard.add(cur)
    cur = byId.get(cur)?.parent_id ?? null
  }
  return false
}

export async function moveItems(
  input: z.input<typeof moveSchema>
): Promise<SimpleResult> {
  const p = moveSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  // Cycle guard: a folder cannot move into itself or its own descendant.
  if (p.data.folderIds.length > 0 && p.data.targetFolderId) {
    const { data: all } = await ctx.supabase
      .from("knowledge_folders")
      .select("id, parent_id")
      .eq("organization_id", p.data.organizationId)
    const folders = all ?? []
    for (const fid of p.data.folderIds) {
      if (isInSubtree(folders, p.data.targetFolderId, fid)) {
        return { ok: false, error: "Bir klasör kendi içine taşınamaz" }
      }
    }
  }

  if (p.data.folderIds.length > 0) {
    const { error } = await ctx.supabase
      .from("knowledge_folders")
      .update({ parent_id: p.data.targetFolderId })
      .in("id", p.data.folderIds)
    if (error) return { ok: false, error: error.message }
  }
  if (p.data.sourceIds.length > 0) {
    const { error } = await ctx.supabase
      .from("knowledge_sources")
      .update({ folder_id: p.data.targetFolderId })
      .in("id", p.data.sourceIds)
    if (error) return { ok: false, error: error.message }
  }

  revalidateKnowledgeSurfaces(p.data.slug)
  return { ok: true }
}

const deleteSchema = z.object({
  slug: z.string().min(1),
  folderIds: z.array(z.string().uuid()).default([]),
  sourceIds: z.array(z.string().uuid()).default([]),
})

/**
 * Bulk delete. File sources have their storage object removed first; chunks are
 * removed by FK cascade. Folders cascade to descendant folders; their sources'
 * folder_id is set null by FK (they move to root rather than vanish).
 */
export async function deleteItems(
  input: z.input<typeof deleteSchema>
): Promise<SimpleResult> {
  const p = deleteSchema.safeParse(input)
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Geçersiz veri" }

  const ctx = await requireUser()
  if (!ctx) return { ok: false, error: "Yetkisiz" }

  if (p.data.sourceIds.length > 0) {
    const { data: srcs } = await ctx.supabase
      .from("knowledge_sources")
      .select("raw_ref, kind")
      .in("id", p.data.sourceIds)
    // Files live in the private docs bucket; images in the public image bucket.
    const filePaths = (srcs ?? [])
      .filter((s) => s.kind === "file" && s.raw_ref)
      .map((s) => s.raw_ref as string)
    const imagePaths = (srcs ?? [])
      .filter((s) => s.kind === "image" && s.raw_ref)
      .map((s) => s.raw_ref as string)
    if (filePaths.length > 0) {
      await ctx.supabase.storage.from(KNOWLEDGE_BUCKET).remove(filePaths)
    }
    if (imagePaths.length > 0) {
      await ctx.supabase.storage.from(KNOWLEDGE_IMAGE_BUCKET).remove(imagePaths)
    }
    const { error } = await ctx.supabase
      .from("knowledge_sources")
      .delete()
      .in("id", p.data.sourceIds)
    if (error) return { ok: false, error: error.message }
  }

  if (p.data.folderIds.length > 0) {
    const { error } = await ctx.supabase
      .from("knowledge_folders")
      .delete()
      .in("id", p.data.folderIds)
    if (error) return { ok: false, error: error.message }
  }

  revalidateKnowledgeSurfaces(p.data.slug)
  return { ok: true }
}

/** Single-source delete (kept for the Detail sheet / row menu). */
export async function deleteSource(
  sourceId: string,
  slug: string
): Promise<ActionResult> {
  const res = await deleteItems({ slug, sourceIds: [sourceId], folderIds: [] })
  if (!res.ok) return res
  return { ok: true, sourceId }
}
