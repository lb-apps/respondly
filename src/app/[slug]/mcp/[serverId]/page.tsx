import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getMcpServer } from "@/lib/supabase/queries/mcp-servers"
import { McpServerForm } from "../mcp-server-form"
import {
  MCP_STATUS_LABELS,
  MCP_STATUS_VARIANTS,
  recordToRows,
  queryParamRows,
} from "../schema"

export default async function McpServerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; serverId: string }>
}) {
  const { slug, serverId } = await params
  await headers()

  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  const server = await getMcpServer(serverId)
  if (!server || server.organization_id !== org.id) notFound()

  const statusKey = server.enabled ? server.status : "disconnected"

  return (
    <main className="mx-auto w-full max-w-3xl p-6 lg:p-10">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-1 gap-1.5">
        <Link href={`/${slug}/mcp`}>
          <ArrowLeft className="size-4" /> MCP Sunucuları
        </Link>
      </Button>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{server.name}</h1>
          <Badge variant={MCP_STATUS_VARIANTS[statusKey] ?? "outline"}>
            {server.enabled
              ? (MCP_STATUS_LABELS[server.status] ?? server.status)
              : "Kapalı"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Araçlar <code>{server.slug}_</code> ön ekiyle asistana sunulur.
        </p>
        {server.status === "error" && server.error ? (
          <p className="mt-3 text-sm text-destructive">{server.error}</p>
        ) : null}
      </header>

      <McpServerForm
        slug={slug}
        organizationId={org.id}
        initial={{
          id: server.id,
          hasSecret: server.hasSecret,
          name: server.name,
          slug: server.slug,
          url: server.url,
          transport: server.transport === "sse" ? "sse" : "http",
          authKind:
            server.auth_kind === "bearer" || server.auth_kind === "header"
              ? server.auth_kind
              : "none",
          authHeaderName: server.auth_header_name ?? "",
          secret: "",
          headers: recordToRows(server.headers),
          queryParams: queryParamRows(server.query_params, server.link_params),
          timeoutMs: server.timeout_ms,
          enabled: server.enabled,
        }}
      />
    </main>
  )
}
