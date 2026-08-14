import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getOrgAssistant } from "@/lib/supabase/queries/assistants"
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

  const assistant = await getOrgAssistant(org.id)

  return (
    <PreviewPageClient
      slug={slug}
      organizationId={org.id}
      orgName={org.name}
      assistantId={assistant?.id ?? null}
    />
  )
}
