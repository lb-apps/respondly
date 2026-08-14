import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getOrgAssistant } from "@/lib/supabase/queries/assistants"
import {
  getFolderAncestors,
  getMediaUsage,
  listKnowledgeTree,
} from "@/lib/supabase/queries/knowledge"
import { MediaClient } from "./media-client"

export default async function MediaPage({
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

  // Validate the album belongs to this org (and is a media folder) — else bounce.
  const ancestors = await getFolderAncestors(org.id, folderId, "media")
  if (folderId && ancestors.length === 0) {
    redirect(`/${slug}/media`)
  }

  const [assistant, tree, usage] = await Promise.all([
    getOrgAssistant(org.id),
    listKnowledgeTree(org.id, folderId, "media"),
    getMediaUsage(org),
  ])

  const currentFolder = ancestors.length ? ancestors[ancestors.length - 1] : null

  return (
    <MediaClient
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
