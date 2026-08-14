import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getOrgMcpServers } from "@/lib/supabase/queries/mcp-servers"
import { toolSummariesFromCache } from "@/lib/mcp/tool-cache"
import { McpServersClient } from "./mcp-servers-client"

export default async function McpServersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  const servers = await getOrgMcpServers(org.id)

  return (
    <main className="mx-auto w-full max-w-4xl p-6 lg:p-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCP Sunucuları</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Kendi sistemlerinizi bağlayın. Asistan, bağladığınız sunucuların
            araçlarını konuşma sırasında canlı olarak kullanır.
          </p>
        </div>
        {servers.length > 0 ? (
          <Button asChild>
            <Link href={`/${slug}/mcp/new`}>
              <Plus className="size-4" /> Sunucu ekle
            </Link>
          </Button>
        ) : null}
      </header>

      <McpServersClient
        slug={slug}
        servers={servers.map((server) => ({
          id: server.id,
          name: server.name,
          slug: server.slug,
          url: server.url,
          status: server.status,
          error: server.error,
          enabled: server.enabled,
          toolsSyncedAt: server.tools_synced_at,
          tools: toolSummariesFromCache(server.tools),
        }))}
      />
    </main>
  )
}
