/**
 * Normalize whatever an MCP tool hands back into a plain value.
 *
 * MCP servers answer with content blocks — most JSON tools ship a single text
 * block containing `JSON.stringify(value, null, 2)`. Depending on the client
 * version we may receive the raw `CallToolResult`, a bare string, or an already
 * unwrapped value, so all four shapes are handled here. Pure function.
 */

export interface ParsedMcpResult {
  /** The most useful value we could recover — parsed JSON when possible. */
  value: unknown
  /** Raw text of the first text block, when there was one. */
  text: string | null
  isError: boolean
}

function tryParseJson(text: string): { parsed: unknown; ok: boolean } {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { parsed: text, ok: false }
  }
  try {
    return { parsed: JSON.parse(trimmed), ok: true }
  } catch {
    return { parsed: text, ok: false }
  }
}

function readTextBlocks(content: unknown): string | null {
  if (!Array.isArray(content)) return null
  const texts = content
    .map((block) =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: string }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
        ? ((block as { text: string }).text)
        : null
    )
    .filter((text): text is string => Boolean(text))
  return texts.length > 0 ? texts.join("\n\n") : null
}

export function parseMcpToolResult(raw: unknown): ParsedMcpResult {
  if (raw == null) return { value: null, text: null, isError: false }

  if (typeof raw === "string") {
    const { parsed, ok } = tryParseJson(raw)
    return { value: ok ? parsed : raw, text: raw, isError: false }
  }

  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>
    const isError = record.isError === true
    const text = readTextBlocks(record.content)

    if (text !== null) {
      const { parsed } = tryParseJson(text)
      return { value: parsed, text, isError }
    }
    // Some clients unwrap into `structuredContent` or return the value directly.
    if (record.structuredContent !== undefined) {
      return { value: record.structuredContent, text: null, isError }
    }
    return { value: raw, text: null, isError }
  }

  return { value: raw, text: null, isError: false }
}

/** Compact JSON for logs and claim text, hard-capped so audits stay small. */
export function safeJson(value: unknown, maxChars: number): string {
  let text: string
  try {
    text = typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (!text) return ""
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}
