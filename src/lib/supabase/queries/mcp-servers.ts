import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { MCP_SERVER_PUBLIC_COLUMNS } from "@/lib/mcp/config"
import { toolSummariesFromCache } from "@/lib/mcp/tool-cache"
import type { McpServerSummary } from "@/lib/mcp/types"
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
