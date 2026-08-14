/**
 * Normalizes `agent.generate()` tool call/result shapes.
 *
 * Mastra wraps each `toolResults`/`toolCalls` entry in a `payload` object
 * (`{ payload: { toolName, toolCallId, args, result } }`) rather than exposing
 * those fields at the top level. Every consumer that inspects tool output by
 * name (rich content builders, grounding signals) needs this normalization —
 * skipping it means `toolName` reads as `undefined` and every branch silently
 * no-ops.
 */

export type ToolResultLike = {
  toolName?: string
  name?: string
  toolCallId?: string
  payload?: {
    output?: unknown
    result?: unknown
    input?: unknown
    args?: unknown
  }
  output?: unknown
  result?: unknown
  args?: unknown
}

export type ToolCallLike = {
  id: string
  name: string
  args: Record<string, unknown>
}

export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null
}

export function normalizeToolResults(raw: unknown): ToolResultLike[] {
  if (!Array.isArray(raw)) return []
  const out: ToolResultLike[] = []
  for (const item of raw) {
    const rec = asRecord(item)
    if (!rec) continue
    const payload = asRecord(rec.payload)
    if (payload) {
      out.push({
        toolName: typeof payload.toolName === "string" ? payload.toolName : undefined,
        toolCallId: typeof payload.toolCallId === "string" ? payload.toolCallId : undefined,
        payload: {
          output: payload.result,
          input: payload.args,
          args: payload.args,
        },
        result: payload.result,
        args: payload.args,
      })
      continue
    }
    out.push(rec as ToolResultLike)
  }
  return out
}

export function normalizeToolCalls(raw: unknown): ToolCallLike[] {
  if (!Array.isArray(raw)) return []
  const out: ToolCallLike[] = []
  for (const item of raw) {
    const rec = asRecord(item)
    if (!rec) continue
    const payload = asRecord(rec.payload)
    if (
      payload &&
      typeof payload.toolCallId === "string" &&
      typeof payload.toolName === "string"
    ) {
      out.push({
        id: payload.toolCallId,
        name: payload.toolName,
        args:
          typeof payload.args === "object" && payload.args
            ? (payload.args as Record<string, unknown>)
            : {},
      })
      continue
    }
    if (typeof rec.id === "string" && typeof rec.name === "string") {
      out.push({
        id: rec.id,
        name: rec.name,
        args:
          typeof rec.args === "object" && rec.args
            ? (rec.args as Record<string, unknown>)
            : {},
      })
    }
  }
  return out
}

export function getToolOutput(tr: ToolResultLike): unknown {
  return tr.payload?.output ?? tr.payload?.result ?? tr.output ?? tr.result
}

/** Resolve a tool's invocation args — needed for tools whose output doesn't echo them back (e.g. send_quick_reply). */
export function getToolInput(
  tr: ToolResultLike,
  toolCalls: ToolCallLike[]
): unknown | undefined {
  if (tr.payload?.input && typeof tr.payload.input === "object") {
    return tr.payload.input
  }
  if (tr.payload?.args && typeof tr.payload.args === "object") {
    return tr.payload.args
  }
  if (tr.args && typeof tr.args === "object") return tr.args

  const toolName = tr.toolName ?? tr.name
  if (tr.toolCallId) {
    const byId = toolCalls.find((c) => c.id === tr.toolCallId)
    if (byId?.args) return byId.args
  }
  if (toolName) {
    const byName = toolCalls.find((c) => c.name === toolName)
    if (byName?.args) return byName.args
  }
  return undefined
}
