import { safeJson } from "@/lib/mcp/parse-result"
import {
  asRecord,
  getToolInput,
  getToolOutput,
  type ToolCallLike,
  type ToolResultLike,
} from "@/mastra/tool-results"

/**
 * A bounded record of the tools a turn called, in the exact `parts[]` shape the
 * assistant preview stores. Both surfaces therefore feed one set of extractors
 * (`@/components/chat/message-chips`), so the inbox and the preview cannot
 * drift apart in what they show.
 *
 * Only the fields those chips actually read survive. That is a projection, not
 * a truncation — clipping a tool's JSON output at N characters would leave the
 * Kaynaklar chip parsing a broken object, since it reads
 * `output.passages[].sourceId` rather than a string. The character caps below
 * are a backstop for the one field we do keep verbatim.
 *
 * Pure; no `server-only`, so it can be unit tested.
 */

/** How many tool parts a single turn may record. */
export const TOOL_TRACE_MAX_PARTS = 20
/** Cap for the one input we keep as text (non-inspectable tools). */
export const TOOL_TRACE_INPUT_MAX = 1024
/** Cap for a kept output, applied after projection. */
export const TOOL_TRACE_OUTPUT_MAX = 4096

/** Feeds the Kaynaklar chip. */
const KNOWLEDGE_TOOL = "search_knowledge"
/** Feeds the Tutarsızlık chip. */
const CONFLICT_TOOL = "flag_source_conflict"

export interface ToolTracePart {
  type: "dynamic-tool"
  toolName: string
  input?: unknown
  output?: unknown
}

/**
 * Keep the source identity of each passage and drop its text.
 *
 * The text is the bulk of the payload — up to 600 characters per passage, several
 * passages per call — and no chip renders it. The three id fields are exactly
 * what `extractUsedSources` reads.
 */
function projectKnowledgeOutput(output: unknown): unknown {
  const record = asRecord(output)
  if (!record) return undefined
  const passages = Array.isArray(record.passages) ? record.passages : []

  const projected = passages
    .map((passage) => {
      const p = asRecord(passage)
      if (!p) return null
      if (typeof p.sourceId !== "string" || typeof p.sourceName !== "string") {
        return null
      }
      return {
        sourceId: p.sourceId,
        sourceName: p.sourceName,
        sourceKind: typeof p.sourceKind === "string" ? p.sourceKind : "text",
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  return projected.length > 0 ? { passages: projected } : undefined
}

/** Drop a value that somehow still serialises past the cap. */
function withinCap(value: unknown, maxChars: number): unknown {
  return safeJson(value, maxChars + 1).length > maxChars ? undefined : value
}

function traceOne(
  result: ToolResultLike,
  toolCalls: ToolCallLike[]
): ToolTracePart | null {
  const toolName = result.toolName ?? result.name
  if (!toolName) return null

  if (toolName === KNOWLEDGE_TOOL) {
    const output = projectKnowledgeOutput(getToolOutput(result))
    return {
      type: "dynamic-tool",
      toolName,
      output: withinCap(output, TOOL_TRACE_OUTPUT_MAX),
    }
  }

  if (toolName === CONFLICT_TOOL) {
    // Small by construction, and the chip needs both halves: it prefers the
    // output when the tool confirmed the record and falls back to the input.
    return {
      type: "dynamic-tool",
      toolName,
      input: withinCap(getToolInput(result, toolCalls), TOOL_TRACE_OUTPUT_MAX),
      output: withinCap(getToolOutput(result), TOOL_TRACE_OUTPUT_MAX),
    }
  }

  // Every other tool — built-in or MCP — is only ever rendered as a name in the
  // Araçlar chip. The output can be tens of KB and buys nothing: pictures reach
  // the inbox through `messages.rich_content`. The input is kept as clipped
  // text purely so a human debugging a turn can see what was asked.
  const input = getToolInput(result, toolCalls)
  return {
    type: "dynamic-tool",
    toolName,
    input: input === undefined ? undefined : safeJson(input, TOOL_TRACE_INPUT_MAX),
  }
}

/**
 * Build the trace for one turn. Returns an empty array when no tool ran, so the
 * caller can store `null` and old rows stay indistinguishable from tool-less ones.
 */
export function buildToolTrace(
  toolResults: ToolResultLike[],
  toolCalls: ToolCallLike[] = []
): ToolTracePart[] {
  const parts: ToolTracePart[] = []
  for (const result of toolResults) {
    if (parts.length >= TOOL_TRACE_MAX_PARTS) break
    const part = traceOne(result, toolCalls)
    if (part) parts.push(part)
  }
  return parts
}
