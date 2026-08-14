import { createClient } from "@/lib/supabase/server"
import type {
  KnowledgeFolder,
  KnowledgeSource,
  Organization,
} from "@/types/database"
import {
  getOrgQuota,
  getOrgMediaQuota,
  getUsedBytes,
  getMediaUsedBytes,
  DEFAULT_KNOWLEDGE_QUOTA_BYTES,
} from "@/lib/knowledge/quota"

/** Source/folder category: reference = Knowledge docs, media = Medya albums. */
export type KnowledgeCategory = "reference" | "media"

export type FolderRow = KnowledgeFolder & {
  itemCount: number
  creatorName: string | null
}
export type SourceRow = KnowledgeSource & { creatorName: string | null }
/** Minimal folder for building path-labeled parent pickers. */
export type FolderOption = { id: string; name: string; parent_id: string | null }
export type KnowledgeTree = {
  folders: FolderRow[]
  sources: SourceRow[]
  allFolders: FolderOption[]
}

/** Build a `created_by -> "First Last"` map for the given user ids. */
async function fetchCreatorNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: Array<string | null>
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", unique)
  const map = new Map<string, string>()
  for (const p of data ?? []) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim()
    if (name) map.set(p.id, name)
  }
  return map
}

/**
 * List a folder's contents: child folders (each with item count) + sources, all
 * org-scoped via RLS. `folderId = null` lists the root level. Joins creator
 * profile names for the "Created by" column. Not cached — status changes.
 */
export async function listKnowledgeTree(
  organizationId: string,
  folderId: string | null,
  category: KnowledgeCategory = "reference"
): Promise<KnowledgeTree> {
  const supabase = await createClient()

  // All org folders of this category — drives child listing + item counts.
  const { data: allFolders } = await supabase
    .from("knowledge_folders")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("category", category)
    .order("name", { ascending: true })

  // Minimal source rows to count items per folder. Knowledge and Media are
  // separate surfaces — each lists only its own category.
  const { data: srcFolderIds } = await supabase
    .from("knowledge_sources")
    .select("folder_id")
    .eq("organization_id", organizationId)
    .eq("category", category)

  const folders = allFolders ?? []
  const sourceCountByFolder = new Map<string, number>()
  for (const s of srcFolderIds ?? []) {
    if (!s.folder_id) continue
    sourceCountByFolder.set(
      s.folder_id,
      (sourceCountByFolder.get(s.folder_id) ?? 0) + 1
    )
  }
  const childFolderCount = new Map<string, number>()
  for (const f of folders) {
    if (!f.parent_id) continue
    childFolderCount.set(f.parent_id, (childFolderCount.get(f.parent_id) ?? 0) + 1)
  }

  // Current-level sources (full rows) — this category only.
  let q = supabase
    .from("knowledge_sources")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("category", category)
    .order("updated_at", { ascending: false })
  q = folderId ? q.eq("folder_id", folderId) : q.is("folder_id", null)
  const { data: sources } = await q

  const currentFolders = folders.filter((f) =>
    folderId ? f.parent_id === folderId : f.parent_id === null
  )

  const creators = await fetchCreatorNames(supabase, [
    ...currentFolders.map((f) => f.created_by),
    ...(sources ?? []).map((s) => s.created_by),
  ])

  return {
    folders: currentFolders.map((f) => ({
      ...f,
      itemCount:
        (sourceCountByFolder.get(f.id) ?? 0) + (childFolderCount.get(f.id) ?? 0),
      creatorName: f.created_by ? creators.get(f.created_by) ?? null : null,
    })),
    sources: ((sources ?? []) as KnowledgeSource[]).map((s) => ({
      ...s,
      creatorName: s.created_by ? creators.get(s.created_by) ?? null : null,
    })),
    allFolders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parent_id: f.parent_id,
    })),
  }
}

/**
 * Ancestor chain for a folder, root-first (excludes the folder itself's parent
 * walk stops at root). Returns [] for the root level. Used by the breadcrumb.
 */
export async function getFolderAncestors(
  organizationId: string,
  folderId: string | null,
  category: KnowledgeCategory = "reference"
): Promise<KnowledgeFolder[]> {
  if (!folderId) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("knowledge_folders")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("category", category)
  const byId = new Map((data ?? []).map((f) => [f.id, f]))

  const chain: KnowledgeFolder[] = []
  let cur = byId.get(folderId)
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    chain.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return chain
}

/** Org-wide storage usage for the RAG Storage pill (always org-wide). */
export async function getKnowledgeUsage(
  org: Pick<Organization, "id" | "settings">
): Promise<{ used: number; quota: number }> {
  const supabase = await createClient()
  try {
    const used = await getUsedBytes(supabase, org.id)
    return { used, quota: getOrgQuota(org) }
  } catch {
    return { used: 0, quota: getOrgQuota(org) ?? DEFAULT_KNOWLEDGE_QUOTA_BYTES }
  }
}

/** Org-wide media usage (raw image bytes) for the Medya storage pill. */
export async function getMediaUsage(
  org: Pick<Organization, "id" | "settings">
): Promise<{ used: number; quota: number }> {
  const supabase = await createClient()
  try {
    const used = await getMediaUsedBytes(supabase, org.id)
    return { used, quota: getOrgMediaQuota(org) }
  } catch {
    return { used: 0, quota: getOrgMediaQuota(org) }
  }
}

export type SourceDetail = SourceRow & { chunkCount: number }

/** Full source detail for the Detail sheet: row + chunk count + creator name. */
export async function getSourceDetail(id: string): Promise<SourceDetail | null> {
  const supabase = await createClient()
  const { data: source } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .single()
  if (!source) return null

  const { count } = await supabase
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", id)

  const creators = await fetchCreatorNames(supabase, [source.created_by])
  return {
    ...(source as KnowledgeSource),
    chunkCount: count ?? 0,
    creatorName: source.created_by ? creators.get(source.created_by) ?? null : null,
  }
}

/** @deprecated flat list — kept until callers migrate to listKnowledgeTree. */
export async function listKnowledgeSources(
  organizationId: string
): Promise<KnowledgeSource[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
  return (data ?? []) as KnowledgeSource[]
}
