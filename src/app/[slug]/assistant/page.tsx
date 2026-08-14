import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getOrgAssistant } from "@/lib/supabase/queries/assistants"
import { getMcpToolCatalogue } from "@/lib/supabase/queries/mcp-servers"
import { createClient } from "@/lib/supabase/server"
import { DEFAULT_MODEL } from "@/mastra/openrouter"
import { AssistantClient } from "./assistant-client"

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  const assistant = await getOrgAssistant(org.id)

  // The prompt editor offers these for `@` completion, so a tool name written
  // into the prompt is one the model will actually be handed.
  const mcpServers = await getMcpToolCatalogue(await createClient(), org.id)

  const settings =
    assistant?.settings && typeof assistant.settings === "object" && !Array.isArray(assistant.settings)
      ? (assistant.settings as { firstMessage?: string; timezone?: string })
      : null

  return (
    <AssistantClient
      slug={slug}
      organizationId={org.id}
      orgName={org.name}
      mcpServers={mcpServers}
      initial={{
        id: assistant?.id ?? null,
        name: assistant?.name ?? `${org.name} Asistanı`,
        tone: assistant?.tone ?? "kibar ve profesyonel",
        systemPrompt: assistant?.system_prompt ?? "",
        model: assistant?.model ?? DEFAULT_MODEL,
        firstMessage: settings?.firstMessage ?? "",
        timezone: settings?.timezone ?? org.timezone ?? "Europe/Istanbul",
      }}
    />
  )
}
