/**
 * Text chunking for RAG via Mastra MDocument.
 * Link/crawl sources use semantic-markdown; plain text/file sources use recursive
 * chunking with Turkish FAQ hard-boundary pre-splitting preserved.
 */

import { MDocument } from "@mastra/rag"
import type { KnowledgeSource } from "@/types/database"

const TARGET_CHARS = 1000
const OVERLAP_CHARS = 150
const MAX_CHARS = 1400

export type KnowledgeChunkKind = KnowledgeSource["kind"]

/**
 * Paragraphs that must START a fresh chunk: markdown headings and FAQ question
 * lines (`**S:`, `S:`, `Soru:`). Isolating each section / Q&A keeps every chunk
 * high-signal for short Turkish queries (e.g. "Otopark var mı?").
 */
function isHardBoundary(p: string): boolean {
  return (
    /^#{1,6}\s/.test(p) ||
    /^\*\*\s*(S|Soru)\s*[:.]/i.test(p) ||
    /^(S|Soru)\s*[:.]/i.test(p)
  )
}

function splitLongParagraph(p: string): string[] {
  if (p.length <= MAX_CHARS) return [p]
  const out: string[] = []
  for (let i = 0; i < p.length; i += TARGET_CHARS) {
    out.push(p.slice(i, i + TARGET_CHARS))
  }
  return out
}

/**
 * Pre-split plain text into topic-tight sections before recursive chunking.
 * Mirrors the hard-boundary semantics of the legacy chunkText packer.
 */
export function splitOnHardBoundaries(input: string): string[] {
  const text = input.replace(/\r\n/g, "\n").trim()
  if (!text) return []

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph)

  const sections: string[] = []
  let current = ""

  for (const p of paragraphs) {
    if (!current) {
      current = p
    } else if (isHardBoundary(p)) {
      sections.push(current)
      current = p
    } else if (current.length + p.length + 2 <= TARGET_CHARS) {
      current += "\n\n" + p
    } else {
      sections.push(current)
      const tail = current.slice(-OVERLAP_CHARS)
      current = tail + "\n\n" + p
    }
  }
  if (current.trim()) sections.push(current.trim())

  return sections
}

function chunkTextsFromDoc(doc: MDocument): string[] {
  return doc
    .getText()
    .map((t) => t.trim())
    .filter(Boolean)
}

async function chunkMarkdown(text: string): Promise<string[]> {
  const doc = MDocument.fromMarkdown(text)
  await doc.chunk({
    strategy: "semantic-markdown",
    maxSize: TARGET_CHARS,
    overlap: OVERLAP_CHARS,
  })
  return chunkTextsFromDoc(doc)
}

async function chunkRecursiveSection(text: string): Promise<string[]> {
  if (text.length <= TARGET_CHARS) return [text]

  const doc = MDocument.fromText(text)
  await doc.chunk({
    strategy: "recursive",
    maxSize: TARGET_CHARS,
    overlap: OVERLAP_CHARS,
    separators: ["\n\n", "\n", ". ", " "],
  })
  return chunkTextsFromDoc(doc)
}

async function chunkPlainText(text: string): Promise<string[]> {
  const sections = splitOnHardBoundaries(text)
  const chunks: string[] = []

  for (const section of sections) {
    if (section.length <= TARGET_CHARS) {
      chunks.push(section)
    } else {
      chunks.push(...(await chunkRecursiveSection(section)))
    }
  }

  return chunks
}

/**
 * Chunk knowledge source text for embedding. Strategy depends on source kind.
 */
export async function chunkContent(
  input: string,
  opts: { kind: KnowledgeChunkKind }
): Promise<string[]> {
  const text = input.replace(/\r\n/g, "\n").trim()
  if (!text) return []

  if (opts.kind === "link") {
    return chunkMarkdown(text)
  }

  return chunkPlainText(text)
}

/** @deprecated Use chunkContent — kept for tests comparing legacy behavior. */
export function chunkText(input: string): string[] {
  return splitOnHardBoundaries(input)
}
