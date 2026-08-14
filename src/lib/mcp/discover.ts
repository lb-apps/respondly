import "server-only"

import { randomUUID } from "node:crypto"
import { MCPClient } from "@mastra/mcp"
import type {
  McpDiscoveryResult,
  McpRuntimeVars,
  McpServerConfig,
  McpToolDescriptor,
} from "./types"
import { buildMcpServerDefinition } from "./server-definition"
import { bareToolName, namespacedToolName } from "./toolsets"
import { explainMcpError } from "./errors"

/**
 * One-shot handshake used by the dashboard's "test connection" action:
 * initialize + tools/list, then throw the connection away.
 */

/** Placeholder values for templated headers/params during a manual test. */
function discoveryVars(config: McpServerConfig): McpRuntimeVars {
  return {
    orgId: config.organizationId,
    guestLocale: "tr",
    orgCurrency: "TRY",
    orgTimezone: "Europe/Istanbul",
  }
}

/** Hard ceiling for a manual test, whatever the client's own timeout does. */
const DISCOVERY_DEADLINE_MS = 45_000

function withDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer)) as Promise<T>
}

export async function discoverMcpServer(
  config: McpServerConfig
): Promise<McpDiscoveryResult> {
  const started = Date.now()
  const client = new MCPClient({
    id: `discover_${config.id}_${randomUUID()}`,
    servers: {
      [config.slug]: buildMcpServerDefinition(config, discoveryVars(config)),
    },
  })

  try {
    const { toolsets, errors } = await withDeadline(
      client.listToolsetsWithErrors(),
      Math.min(DISCOVERY_DEADLINE_MS, config.timeoutMs * 3),
      "Sunucu zamanında yanıt vermedi (timeout)."
    )
    const failure = errors?.[config.slug]
    if (failure) {
      return {
        ok: false,
        tools: [],
        error: explainMcpError(String(failure)),
        latencyMs: Date.now() - started,
      }
    }

    const rawTools = (toolsets?.[config.slug] ?? {}) as Record<string, unknown>
    const tools: McpToolDescriptor[] = Object.entries(rawTools).map(
      ([rawName, tool]) => {
        const originalName = bareToolName(config.slug, rawName)
        const description = (tool as { description?: unknown })?.description
        return {
          name: namespacedToolName(config.slug, originalName),
          originalName,
          description:
            typeof description === "string" ? description.slice(0, 400) : "",
        }
      }
    )

    return {
      ok: true,
      tools,
      error: null,
      latencyMs: Date.now() - started,
    }
  } catch (err) {
    return {
      ok: false,
      tools: [],
      error: explainMcpError(
        err instanceof Error ? err.message : "Bağlantı kurulamadı"
      ),
      latencyMs: Date.now() - started,
    }
  } finally {
    // The answer is already in hand; tearing the connection down must not keep
    // the operator's spinner running.
    void client.disconnect().catch(() => {})
  }
}
