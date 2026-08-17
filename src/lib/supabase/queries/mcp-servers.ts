import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { MCP_SERVER_PUBLIC_COLUMNS, toStringRecord } from "@/lib/mcp/config"
import { toolSummariesFromCache } from "@/lib/mcp/tool-cache"
import type { McpServerSummary } from "@/lib/mcp/types"
import { linkParamsFrom, type LinkParam } from "@/lib/mcp/link-params"
import type { Database, McpServer } from "@/types/database"

/** A row plus the derived flags the UI needs. Secret ids never leave the server. */
export type McpServerListItem = Omit<McpServer, "auth_secret_id"> & {
  hasSecret: boolean
}

/** All MCP servers for an org. RLS scopes this to the caller's orgs. */
export const getOrgMcpServers = cache(
  async (organizationId: string): Promise<McpServerListItem[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("mcp_servers")
      .select(`${MCP_SERVER_PUBLIC_COLUMNS}, auth_secret_id`)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })

    if (error || !data) return []
    return (data as McpServer[]).map(withSecretFlag)
  }
)

export const getMcpServer = cache(
  async (serverId: string): Promise<McpServerListItem | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("mcp_servers")
      .select(`${MCP_SERVER_PUBLIC_COLUMNS}, auth_secret_id`)
      .eq("id", serverId)
      .maybeSingle()

    if (error || !data) return null
    return withSecretFlag(data as McpServer)
  }
)

function withSecretFlag(row: McpServer): McpServerListItem {
  const { auth_secret_id, ...rest } = row
  return { ...rest, hasSecret: Boolean(auth_secret_id) }
}

/**
 * Cached tool catalogue for the system prompt. Reads the `tools` column filled
 * by the last successful discovery rather than opening a connection, so the
 * prompt text stays byte-stable between turns (prompt caching).
 */
export async function getMcpToolCatalogue(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<McpServerSummary[]> {
  const { data, error } = await supabase
    .from("mcp_servers")
    .select("slug, name, tools")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .order("created_at", { ascending: true })

  if (error || !data) return []

  return data
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      tools: toolSummariesFromCache(row.tools),
    }))
    .filter((server) => server.tools.length > 0)
}

/**
 * The params the org has marked to ride on links to its own site.
 *
 * Its own query rather than a field on the tool catalogue: that one drops
 * servers whose tools have not been discovered yet, and a marked param is still
 * marked on a server the assistant cannot call today.
 */
export async function getLinkParams(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<LinkParam[]> {
  const { data, error } = await supabase
    .from("mcp_servers")
    .select("query_params, link_params")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    // Same order the catalogue uses, so a repeated name resolves to the same
    // server in both places and the cached prompt does not flip between turns.
    .order("created_at", { ascending: true })

  if (error || !data) return []
  return linkParamsFrom(
    data.map((row) => ({
      queryParams: toStringRecord(row.query_params),
      linkParams: row.link_params,
    }))
  )
}
