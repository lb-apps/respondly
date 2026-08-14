import type { McpServerConfig, McpToolDescriptor } from "./types"
import { parseMcpToolResult, safeJson } from "./parse-result"
import { extractMcpImages } from "@/lib/mcp/images"
import { DELIVERY_IMAGES_AFTER_REPLY } from "@/lib/assistant/delivery"

/**
 * Namespacing and hardening for tools that arrive from a third-party server.
 *
 * Mastra merges toolset entries into the model's tool dictionary using the
 * *inner* key verbatim, and the merge happens after the agent's own tools —
 * so an MCP server advertising `search_knowledge` would silently replace our
 * built-in. Every name is therefore re-keyed here, and built-in names are
 * refused outright.
 */

/** Built-in tool ids an MCP server must never be able to shadow. */
const RESERVED_TOOL_NAMES = new Set([
  "search_knowledge",
  "ask_choice",
  "show_carousel",
  "request_location",
  "send_link_button",
  "flag_source_conflict",
  "get_contact_profile",
  "update_contact_profile",
])

/** Provider limit: tool names are `^[a-zA-Z_][a-zA-Z0-9_-]*$`, max 63 chars. */
export function namespacedToolName(slug: string, toolName: string): string {
  const raw = `${slug}_${toolName}`.replace(/[^a-zA-Z0-9_-]/g, "_")
  const safe = /^[a-zA-Z_]/.test(raw) ? raw : `_${raw}`
  return safe.slice(0, 63)
}

/** Drop a `serverName_` / `serverName.` prefix the client may have applied. */
export function bareToolName(slug: string, name: string): string {
  if (name.includes(".")) return name.split(".").pop() ?? name
  return name.startsWith(`${slug}_`) ? name.slice(slug.length + 1) : name
}

type UnknownTool = {
  description?: string
  execute?: (...args: unknown[]) => Promise<unknown>
  [key: string]: unknown
}

export interface WrapToolsOptions {
  config: McpServerConfig
  /** Called after every successful tool result, for the claim audit. */
  onResult?: (event: {
    server: McpServerConfig
    toolName: string
    exposedName: string
    input: unknown
    value: unknown
  }) => void
}

/** Envelope returned to the model when a tool cannot answer. */
export interface McpToolError {
  ok: false
  error: string
  server: string
}

export function isMcpToolError(value: unknown): value is McpToolError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok?: unknown }).ok === false &&
    typeof (value as { error?: unknown }).error === "string"
  )
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === "string" ? err : "Bilinmeyen hata"
}

/** Adds the delivery fact to a result that carries images, and nothing else. */
function withImageDeliveryNote(value: unknown): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    extractMcpImages(value, 1).length === 0
  ) {
    return value
  }
  return { ...(value as Record<string, unknown>), imageDelivery: DELIVERY_IMAGES_AFTER_REPLY }
}

function wrapTool(
  tool: UnknownTool,
  meta: { exposedName: string; toolName: string },
  options: WrapToolsOptions
): UnknownTool {
  const original = tool.execute?.bind(tool)

  return {
    ...tool,
    // Signature varies between Mastra-shaped and Vercel-shaped tools, so pass
    // arguments straight through instead of assuming a shape.
    execute: async (...args: unknown[]) => {
      if (!original) {
        return {
          ok: false,
          error: "Tool is not executable",
          server: options.config.slug,
        } satisfies McpToolError
      }
      try {
        const raw = await original(...args)
        const parsed = parseMcpToolResult(raw)

        if (parsed.isError) {
          return {
            ok: false,
            error: parsed.text ?? "Tool returned an error",
            server: options.config.slug,
          } satisfies McpToolError
        }

        options.onResult?.({
          server: options.config,
          toolName: meta.toolName,
          exposedName: meta.exposedName,
          input: args[0],
          value: parsed.value,
        })

        // A tool result carrying pictures becomes pictures the customer is
        // shown, and those go out after the reply text (`sendAssistantReply`).
        // The tool has no way to say so, so we say it here — otherwise the
        // model writes "the photos above" about photos still queued behind its
        // own sentence. See `@/lib/assistant/delivery`.
        return withImageDeliveryNote(parsed.value)
      } catch (err) {
        // One unreachable system must not take the whole turn down.
        console.error("[mcp] tool failed", meta.exposedName, err)
        return {
          ok: false,
          error: errorMessage(err),
          server: options.config.slug,
        } satisfies McpToolError
      }
    },
  }
}

export interface NamespacedToolset {
  tools: Record<string, unknown>
  descriptors: McpToolDescriptor[]
  /** Tool names refused because they collide with a built-in. */
  rejected: string[]
}

/** Re-key and wrap one server's tools for safe injection into a turn. */
export function namespaceAndWrapTools(
  rawTools: Record<string, unknown>,
  options: WrapToolsOptions
): NamespacedToolset {
  const { config } = options
  const tools: Record<string, unknown> = {}
  const descriptors: McpToolDescriptor[] = []
  const rejected: string[] = []

  for (const [rawName, tool] of Object.entries(rawTools)) {
    const originalName = bareToolName(config.slug, rawName)

    if (RESERVED_TOOL_NAMES.has(originalName)) {
      rejected.push(originalName)
      continue
    }

    const exposedName = namespacedToolName(config.slug, originalName)
    if (tools[exposedName]) continue

    const typed = tool as UnknownTool
    tools[exposedName] = wrapTool(
      typed,
      { exposedName, toolName: originalName },
      options
    )
    descriptors.push({
      name: exposedName,
      originalName,
      description:
        typeof typed.description === "string"
          ? typed.description.slice(0, 400)
          : "",
    })
  }

  return { tools, descriptors, rejected }
}

/** Short, size-capped description of a tool call for the claim audit. */
export function describeToolCall(
  exposedName: string,
  input: unknown,
  value: unknown
): string {
  return `${exposedName}(${safeJson(input, 400)}) → ${safeJson(value, 2000)}`
}
