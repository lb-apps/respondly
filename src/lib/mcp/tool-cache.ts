import type { Json } from "@/types/database"
import type { McpToolDescriptor } from "./types"

/**
 * The `mcp_servers.tools` column stores the tool catalogue discovered by the
 * last successful connection test. It is untyped JSON, so read it defensively —
 * an operator (or an older schema) may leave anything in there.
 */

export function toolSummariesFromCache(value: Json | null): McpToolDescriptor[] {
  if (!Array.isArray(value)) return []

  const out: McpToolDescriptor[] = []
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue
    }
    const record = entry as Record<string, unknown>
    const name = typeof record.name === "string" ? record.name : null
    if (!name) continue
    out.push({
      name,
      originalName:
        typeof record.originalName === "string" ? record.originalName : name,
      description:
        typeof record.description === "string" ? record.description : "",
    })
  }
  return out
}

export function toolSummariesToJson(tools: McpToolDescriptor[]): Json {
  return tools.map((tool) => ({
    name: tool.name,
    originalName: tool.originalName,
    description: tool.description,
  })) as unknown as Json
}
