import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getOrgAssistant } from "@/lib/supabase/queries/assistants"
import { listPreviewPersonas } from "@/lib/supabase/queries/preview-personas"
import { PreviewPageClient } from "./preview-client"

export default async function AssistantPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  // Loaded here rather than in the client: the picker is the first thing on
  // screen, so it arrives with the page instead of flashing an empty grid.
  const [assistant, personas] = await Promise.all([
    getOrgAssistant(org.id),
    listPreviewPersonas(org.id),
  ])

  return (
    <PreviewPageClient
      slug={slug}
      organizationId={org.id}
      assistantId={assistant?.id ?? null}
      personas={personas}
    />
  )
}
