/**
 * WhatsApp message text formatting (official syntax).
 *
 * @see https://faq.whatsapp.com/539178204879377
 *
 * Inline: *bold*, _italic_, ~strikethrough~, `inline code`, ```monospace```
 * Block (line-start): * item / - item, 1. item, > quote
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "strike"; children: InlineNode[] }
  | { type: "inlineCode"; value: string }
  | { type: "monospace"; value: string }

export type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "bullet"; marker: "*" | "-"; children: InlineNode[] }
  | { type: "numbered"; index: number; children: InlineNode[] }
  | { type: "quote"; children: InlineNode[] }
  | { type: "monospaceBlock"; value: string }
  | { type: "blank" }

type FormatKind = "bold" | "italic" | "strike" | "inlineCode" | "monospace"

const INLINE_RULES: ReadonlyArray<{ kind: FormatKind; delimiter: string }> = [
  { kind: "monospace", delimiter: "```" },
  { kind: "inlineCode", delimiter: "`" },
  { kind: "bold", delimiter: "*" },
  { kind: "italic", delimiter: "_" },
  { kind: "strike", delimiter: "~" },
]

function isAlphanumeric(char: string | undefined): boolean {
  if (!char) return false
  const code = char.charCodeAt(0)
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57)
  )
}

/** Pair delimiters using WhatsApp boundary rules (ported from @flasd/whatsapp-formatting). */
function findDelimiterPairs(text: string, delimiter: string): Array<[number, number]> {
  const positions: number[] = []

  for (let i = 0; i <= text.length - delimiter.length; i++) {
    if (text.slice(i, i + delimiter.length) !== delimiter) {
      if (text.charCodeAt(i) === 10 && positions.length % 2 === 1) {
        positions.pop()
      }
      continue
    }

    const isClose = positions.length % 2 === 1
    const before = text[i - 1]
    const after = text[i + delimiter.length]

    if (isClose) {
      if (before === " " || isAlphanumeric(after)) break
      positions.push(i)
    } else {
      if (after === undefined || after === " " || isAlphanumeric(before)) break
      positions.push(i)
    }

    i += delimiter.length - 1
  }

  if (positions.length % 2 === 1) positions.pop()

  const pairs: Array<[number, number]> = []
  for (let i = 0; i + 1 < positions.length; i += 2) {
    pairs.push([positions[i]!, positions[i + 1]!])
  }
  return pairs
}

function parseInline(text: string): InlineNode[] {
  if (!text) return []

  let earliest: {
    open: number
    close: number
    kind: FormatKind
    delimiter: string
  } | null = null

  for (const rule of INLINE_RULES) {
    const pairs = findDelimiterPairs(text, rule.delimiter)
    const first = pairs[0]
    if (!first) continue
    if (!earliest || first[0] < earliest.open) {
      earliest = {
        open: first[0],
        close: first[1],
        kind: rule.kind,
        delimiter: rule.delimiter,
      }
    }
  }

  if (!earliest) {
    return text ? [{ type: "text", value: text }] : []
  }

  const { open, close, kind, delimiter } = earliest
  const before = text.slice(0, open)
  const inner = text.slice(open + delimiter.length, close)
  const after = text.slice(close + delimiter.length)

  const nodes: InlineNode[] = []
  if (before) nodes.push(...parseInline(before))

  if (kind === "inlineCode" || kind === "monospace") {
    nodes.push({ type: kind, value: inner })
  } else {
    nodes.push({ type: kind, children: parseInline(inner) })
  }

  if (after) nodes.push(...parseInline(after))
  return nodes
}

function parseLine(line: string): BlockNode {
  if (line === "") return { type: "blank" }

  const quote = /^>\s?(.*)$/.exec(line)
  if (quote) return { type: "quote", children: parseInline(quote[1]!) }

  const numbered = /^(\d{1,2})\.\s+(.*)$/.exec(line)
  if (numbered) {
    return {
      type: "numbered",
      index: Number.parseInt(numbered[1]!, 10),
      children: parseInline(numbered[2]!),
    }
  }

  const bullet = /^([-*])\s+(.*)$/.exec(line)
  if (bullet) {
    return {
      type: "bullet",
      marker: bullet[1] as "*" | "-",
      children: parseInline(bullet[2]!),
    }
  }

  return { type: "paragraph", children: parseInline(line) }
}

function splitMonospaceBlocks(
  text: string
): Array<{ kind: "text"; value: string } | { kind: "mono"; value: string }> {
  const parts: Array<{ kind: "text"; value: string } | { kind: "mono"; value: string }> = []
  let cursor = 0

  while (cursor < text.length) {
    const open = text.indexOf("```", cursor)
    if (open === -1) {
      parts.push({ kind: "text", value: text.slice(cursor) })
      break
    }

    if (open > cursor) {
      parts.push({ kind: "text", value: text.slice(cursor, open) })
    }

    const close = text.indexOf("```", open + 3)
    if (close === -1) {
      parts.push({ kind: "text", value: text.slice(open) })
      break
    }

    parts.push({ kind: "mono", value: text.slice(open + 3, close) })
    cursor = close + 3
  }

  return parts
}

/** Parse a WhatsApp-formatted message body into renderable blocks. */
export function parseWhatsAppMessage(text: string): BlockNode[] {
  if (!text) return []

  const normalized = text.replace(/\r\n/g, "\n")
  const blocks: BlockNode[] = []

  for (const part of splitMonospaceBlocks(normalized)) {
    if (part.kind === "mono") {
      blocks.push({ type: "monospaceBlock", value: part.value })
      continue
    }

    const lines = part.value.split("\n")
    for (const line of lines) {
      blocks.push(parseLine(line))
    }
  }

  return blocks
}
