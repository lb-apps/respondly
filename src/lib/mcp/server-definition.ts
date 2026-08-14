import type { MastraMCPServerDefinition } from "@mastra/mcp"
import type { McpRuntimeVars, McpServerConfig } from "./types"
import { buildMcpEndpointUrl, renderTemplateValues } from "./url"

/**
 * Translate our transport-agnostic config into the shape `@mastra/mcp` wants.
 *
 * SOLID: the only place that knows about the MCP client library's config
 * format. Adding a transport (stdio, OAuth) starts and ends here.
 */

function authHeaders(config: McpServerConfig): Record<string, string> {
  if (!config.secret) return {}
  if (config.authKind === "bearer") {
    return { Authorization: `Bearer ${config.secret}` }
  }
  if (config.authKind === "header" && config.authHeaderName) {
    return { [config.authHeaderName]: config.secret }
  }
  return {}
}

export function buildMcpServerDefinition(
  config: McpServerConfig,
  vars: McpRuntimeVars
): MastraMCPServerDefinition {
  const templateVars: Record<string, string> = {
    guestLocale: vars.guestLocale,
    orgCurrency: vars.orgCurrency,
    orgTimezone: vars.orgTimezone,
  }

  const url = buildMcpEndpointUrl(config.url, config.queryParams, templateVars)
  const headers = {
    ...renderTemplateValues(config.headers, templateVars),
    ...authHeaders(config),
  }

  return {
    url,
    requestInit: { headers },
    // The SSE fallback issues its own GET; without this the auth header is
    // dropped and the server answers 401 instead of falling back cleanly.
    eventSourceInit: {
      fetch: (input: Request | URL | string, init?: RequestInit) =>
        fetch(input, {
          ...init,
          headers: { ...(init?.headers ?? {}), ...headers },
        }),
    },
    // Pin the connection to the configured host so a redirect cannot walk the
    // credentialed request onto another origin.
    allowedHosts: [url.host],
    timeout: config.timeoutMs,
    // A WhatsApp turn cannot pause for a human to approve a tool call.
    requireToolApproval: false,
    // Server-authored instructions are untrusted text — never fold them into
    // the system prompt.
    forwardInstructions: false,
    // Surface `isError` results to our wrapper instead of throwing, so one
    // failing tool becomes a structured answer rather than a broken turn.
    onToolError: "return",
    enableServerLogs: false,
  }
}
