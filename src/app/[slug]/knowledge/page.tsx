import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getOrgAssistant } from "@/lib/supabase/queries/assistants"
import {
  getFolderAncestors,
  getKnowledgeUsage,
  listKnowledgeTree,
} from "@/lib/supabase/queries/knowledge"
import { KnowledgeClient } from "./knowledge-client"

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ folder?: string }>
}) {
  const { slug } = await params
  const { folder } = await searchParams
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  const folderId = folder ?? null

  // Validate the folder belongs to this org — else bounce to root.
  const ancestors = await getFolderAncestors(org.id, folderId)
  if (folderId && ancestors.length === 0) {
    redirect(`/${slug}/knowledge`)
  }

  const [assistant, tree, usage] = await Promise.all([
    getOrgAssistant(org.id),
    listKnowledgeTree(org.id, folderId),
    getKnowledgeUsage(org),
  ])

  const currentFolder = ancestors.length ? ancestors[ancestors.length - 1] : null

  return (
    <KnowledgeClient
      slug={slug}
      organizationId={org.id}
      assistantId={assistant?.id ?? null}
      folderId={folderId}
      currentFolderName={currentFolder?.name ?? null}
      parentFolderId={currentFolder?.parent_id ?? null}
      ancestors={ancestors.map((f) => ({ id: f.id, name: f.name }))}
      folders={tree.folders}
      sources={tree.sources}
      allFolders={tree.allFolders}
      usage={usage}
    />
  )
}
