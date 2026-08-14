/**
 * Domain types for the MCP integration layer.
 *
 * SOLID: these describe *what* an MCP connection is, decoupled from the
 * `mcp_servers` row shape and from `@mastra/mcp`. Everything above this file
 * (agent turn, prompt, dashboard) depends on these, not on the transport.
 */

export const MCP_TRANSPORTS = ["http", "sse"] as const
export type McpTransport = (typeof MCP_TRANSPORTS)[number]

export const MCP_AUTH_KINDS = ["none", "bearer", "header"] as const
export type McpAuthKind = (typeof MCP_AUTH_KINDS)[number]

export const MCP_STATUSES = ["connected", "disconnected", "error"] as const
export type McpStatus = (typeof MCP_STATUSES)[number]

/** A resolved, ready-to-connect server — secrets already decrypted. */
export interface McpServerConfig {
  id: string
  organizationId: string
  /** Namespace prefix for this server's tool names. */
  slug: string
  name: string
  url: string
  transport: McpTransport
  authKind: McpAuthKind
  /** Header carrying the secret when authKind === "header". */
  authHeaderName: string | null
  /** Decrypted secret, or null when the server needs no auth. */
  secret: string | null
  /** Extra static headers (non-secret). */
  headers: Record<string, string>
  /** Extra query params appended to the endpoint URL. */
  queryParams: Record<string, string>
  timeoutMs: number
}

/** One tool as advertised by a server, in the form the UI and prompt need. */
export interface McpToolDescriptor {
  /** Name the model sees — namespaced with the server slug. */
  name: string
  /** Name the server itself uses. */
  originalName: string
  description: string
}

/** What a server contributed to a turn (or last discovery). */
export interface McpServerSummary {
  slug: string
  name: string
  tools: McpToolDescriptor[]
}

export interface McpServerFailure {
  slug: string
  name: string
  error: string
}

/** Values substituted into templated headers/query params at call time. */
export interface McpRuntimeVars {
  orgId: string
  guestLocale: string
  orgCurrency: string
  orgTimezone: string
}

export interface McpDiscoveryResult {
  ok: boolean
  tools: McpToolDescriptor[]
  error: string | null
  latencyMs: number
}
