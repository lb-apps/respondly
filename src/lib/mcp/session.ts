import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { MCPClient } from "@mastra/mcp"
import type {
  McpRuntimeVars,
  McpServerConfig,
  McpServerFailure,
  McpServerSummary,
} from "./types"
import { buildMcpServerDefinition } from "./server-definition"
import { namespaceAndWrapTools, type WrapToolsOptions } from "./toolsets"

/**
 * One MCP connection window for a single assistant turn.
 *
 * The remote servers are stateless HTTP, so there is nothing to keep warm
 * between turns; connecting per turn keeps decrypted secrets out of module
 * scope and avoids sockets surviving a serverless freeze.
 */
export interface McpSession {
  /** Ready to hand to `agent.generate({ toolsets })`. */
  toolsets: Record<string, Record<string, unknown>>
  /** Servers that answered, with the tools they contributed. */
  servers: McpServerSummary[]
  /** Servers that could not be reached or listed. */
  failures: McpServerFailure[]
  close(): Promise<void>
}

const EMPTY_SESSION: McpSession = {
  toolsets: {},
  servers: [],
  failures: [],
  close: async () => {},
}

function fingerprint(config: McpServerConfig): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        config.url,
        config.headers,
        config.queryParams,
        config.authKind,
        config.authHeaderName,
      ])
    )
    .digest("hex")
    .slice(0, 12)
}

export function emptyMcpSession(): McpSession {
  return EMPTY_SESSION
}

/**
 * Connect to every configured server and expose their tools as namespaced
 * toolsets. Per-server failures are collected, never thrown — a broken
 * integration must not end the conversation.
 */
export async function openMcpSession(
  configs: McpServerConfig[],
  vars: McpRuntimeVars,
  hooks: Pick<WrapToolsOptions, "onResult"> = {}
): Promise<McpSession> {
  if (configs.length === 0) return EMPTY_SESSION

  const bySlug = new Map(configs.map((config) => [config.slug, config]))
  const client = new MCPClient({
    // Unique per turn: identical configurations without an id trip Mastra's
    // duplicate-instance guard.
    id: `org_${vars.orgId}_${configs.map(fingerprint).join("_")}_${randomUUID()}`,
    servers: Object.fromEntries(
      configs.map((config) => [
        config.slug,
        buildMcpServerDefinition(config, vars),
      ])
    ),
  })

  const close = async () => {
    try {
      await client.disconnect()
    } catch (err) {
      console.error("[mcp] disconnect failed", err)
    }
  }

  try {
    const { toolsets: rawToolsets, errors } =
      await client.listToolsetsWithErrors()

    const toolsets: Record<string, Record<string, unknown>> = {}
    const servers: McpServerSummary[] = []
    const failures: McpServerFailure[] = []

    for (const [slug, rawTools] of Object.entries(rawToolsets)) {
      const config = bySlug.get(slug)
      if (!config) continue

      const { tools, descriptors, rejected } = namespaceAndWrapTools(
        rawTools as Record<string, unknown>,
        { config, onResult: hooks.onResult }
      )
      if (rejected.length > 0) {
        console.warn(
          `[mcp] ${slug} advertised reserved tool name(s): ${rejected.join(", ")} — ignored`
        )
      }
      if (Object.keys(tools).length === 0) continue

      toolsets[slug] = tools
      servers.push({ slug, name: config.name, tools: descriptors })
    }

    for (const [slug, message] of Object.entries(errors ?? {})) {
      const config = bySlug.get(slug)
      failures.push({
        slug,
        name: config?.name ?? slug,
        error: String(message),
      })
    }

    return { toolsets, servers, failures, close }
  } catch (err) {
    await close()
    console.error("[mcp] session failed", err)
    return {
      toolsets: {},
      servers: [],
      failures: configs.map((config) => ({
        slug: config.slug,
        name: config.name,
        error: err instanceof Error ? err.message : "Bağlantı kurulamadı",
      })),
      close: async () => {},
    }
  }
}
