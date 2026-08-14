import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, McpServer } from "@/types/database"
import type { McpServerConfig } from "./types"

type DB = SupabaseClient<Database>

/** Columns safe to read anywhere. `auth_secret_id` is deliberately excluded. */
export const MCP_SERVER_PUBLIC_COLUMNS =
  "id, organization_id, name, slug, url, transport, auth_kind, auth_header_name, headers, query_params, enabled, status, error, tools, tools_synced_at, timeout_ms, created_at, updated_at"

function toStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw
    else if (typeof raw === "number" || typeof raw === "boolean") out[key] = String(raw)
  }
  return out
}

/** Map a DB row + its decrypted secret into a connect-ready config. */
export function toMcpServerConfig(
  row: Pick<
    McpServer,
    | "id"
    | "organization_id"
    | "name"
    | "slug"
    | "url"
    | "transport"
    | "auth_kind"
    | "auth_header_name"
    | "headers"
    | "query_params"
    | "timeout_ms"
  >,
  secret: string | null
): McpServerConfig {
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    url: row.url,
    transport: row.transport === "sse" ? "sse" : "http",
    authKind:
      row.auth_kind === "bearer" || row.auth_kind === "header"
        ? row.auth_kind
        : "none",
    authHeaderName: row.auth_header_name,
    secret,
    headers: toStringRecord(row.headers),
    queryParams: toStringRecord(row.query_params),
    timeoutMs: row.timeout_ms,
  }
}

/**
 * Load every enabled MCP server for an org, with secrets decrypted.
 *
 * Requires a service-role client: the Vault read RPC is granted to
 * `service_role` only, and the assistant turn runs cookieless.
 */
export async function loadOrgMcpServerConfigs(
  admin: DB,
  orgId: string
): Promise<McpServerConfig[]> {
  const { data, error } = await admin
    .from("mcp_servers")
    .select(
      "id, organization_id, name, slug, url, transport, auth_kind, auth_header_name, headers, query_params, timeout_ms, auth_secret_id"
    )
    .eq("organization_id", orgId)
    .eq("enabled", true)
    .order("created_at", { ascending: true })

  if (error || !data) return []

  return Promise.all(
    data.map(async (row) => {
      let secret: string | null = null
      if (row.auth_kind !== "none" && row.auth_secret_id) {
        const { data: value } = await admin.rpc("get_mcp_server_secret", {
          p_server_id: row.id,
        })
        secret = typeof value === "string" && value ? value : null
      }
      return toMcpServerConfig(row, secret)
    })
  )
}

/** Load one server by id (any enabled state) — used by the test-connection action. */
export async function loadMcpServerConfig(
  admin: DB,
  serverId: string
): Promise<McpServerConfig | null> {
  const { data } = await admin
    .from("mcp_servers")
    .select(
      "id, organization_id, name, slug, url, transport, auth_kind, auth_header_name, headers, query_params, timeout_ms, auth_secret_id"
    )
    .eq("id", serverId)
    .maybeSingle()

  if (!data) return null

  let secret: string | null = null
  if (data.auth_kind !== "none" && data.auth_secret_id) {
    const { data: value } = await admin.rpc("get_mcp_server_secret", {
      p_server_id: data.id,
    })
    secret = typeof value === "string" && value ? value : null
  }
  return toMcpServerConfig(data, secret)
}
