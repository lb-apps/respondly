import { extractText } from "unpdf"
import { isCrawlEnabled, crawlSite } from "@/lib/knowledge/crawl"
import type { CrawlConfig } from "@/types/database"

/**
 * Text extraction for knowledge sources. One responsibility per function.
 * Server-only — relies on Node runtime (unpdf + fetch).
 */

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const { text } = await extractText(data, { mergePages: true })
  return (text ?? "").trim()
}

/** Named HTML entities common in Turkish marketing copy (Wix etc.). */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  uuml: "ü", Uuml: "Ü", ouml: "ö", Ouml: "Ö", ccedil: "ç", Ccedil: "Ç",
  auml: "ä", Auml: "Ä", szlig: "ß", agrave: "à", eacute: "é", copy: "©",
  reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–", rsquo: "'",
  lsquo: "'", rdquo: "”", ldquo: "“", deg: "°", euro: "€",
}

/** Decode numeric (&#931; / &#x1F600;) and named HTML entities. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name] ?? m)
}

/** Strip HTML to readable text. Lightweight — no headless browser. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Fetch a URL's readable text through Jina Reader, which renders JS-heavy pages
 * (Wix, SPAs) server-side and returns clean text — something a plain fetch can't
 * do. Optional JINA_API_KEY raises rate limits. Returns "" on any failure so the
 * caller can fall back to a direct fetch.
 */
async function fetchViaReader(url: string): Promise<string> {
  try {
    const key = process.env.JINA_API_KEY
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      redirect: "follow",
    })
    if (!res.ok) return ""
    return (await res.text()).trim()
  } catch {
    return ""
  }
}

export async function extractLinkText(
  url: string,
  opts?: CrawlConfig
): Promise<string> {
  // Best: whole-site crawl via self-hosted Crawl4AI (renders JS, follows
  // internal links, capped). Only when configured — else fall through.
  if (isCrawlEnabled()) {
    try {
      const crawled = await crawlSite(url, opts)
      if (crawled.length >= 200) return crawled
    } catch {
      // Crawl service unavailable — degrade to single-page extraction below.
    }
  }

  // Fallback: reader proxy (renders JS sites). Falls back to direct fetch.
  const viaReader = await fetchViaReader(url)
  if (viaReader.length >= 200) return viaReader

  const res = await fetch(url, {
    headers: { "user-agent": "RespondlyBot/1.0 (+knowledge-ingest)" },
    redirect: "follow",
  })
  if (!res.ok) {
    if (viaReader) return viaReader
    throw new Error(`Bağlantı getirilemedi (HTTP ${res.status})`)
  }
  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("application/pdf")) {
    const buf = new Uint8Array(await res.arrayBuffer())
    return extractPdfText(buf)
  }
  const html = await res.text()
  const text = htmlToText(html)
  // Prefer whichever yielded more usable content.
  const best = text.length >= viaReader.length ? text : viaReader
  if (!best) throw new Error("Bağlantıdan metin çıkarılamadı")
  return best
}

import {
  SUPPORTED_FILE_EXTS,
  type SupportedFileExt,
} from "@/lib/knowledge/file-upload"

export { SUPPORTED_FILE_EXTS, type SupportedFileExt }

export function isSupportedFileExt(ext: string): ext is SupportedFileExt {
  return (SUPPORTED_FILE_EXTS as readonly string[]).includes(ext.toLowerCase())
}

/** docx → raw text via mammoth. */
async function extractDocxText(buf: Uint8Array): Promise<string> {
  const mammoth = (await import("mammoth")).default
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(buf),
  })
  return (value ?? "").trim()
}

/**
 * epub → concatenated spine text. epub2 reads from a file path, so we stage the
 * buffer in a temp file, parse the spine (reading order), strip each chapter's
 * XHTML to text, and clean up. Runs server-side (Node) only.
 */
async function extractEpubText(buf: Uint8Array): Promise<string> {
  const os = await import("node:os")
  const path = await import("node:path")
  const fs = await import("node:fs/promises")
  const { EPub } = await import("epub2")

  const tmp = path.join(os.tmpdir(), `respondly-${Date.now()}-${Math.random().toString(36).slice(2)}.epub`)
  await fs.writeFile(tmp, Buffer.from(buf))
  try {
    const epub = await EPub.createAsync(tmp)
    const parts: string[] = []
    for (const item of epub.flow) {
      if (!item.id) continue
      try {
        const xhtml = await epub.getChapterAsync(item.id)
        const text = htmlToText(xhtml)
        if (text) parts.push(text)
      } catch {
        // Skip an unreadable chapter rather than fail the whole book.
      }
    }
    return parts.join("\n\n").trim()
  } finally {
    await fs.unlink(tmp).catch(() => {})
  }
}

/**
 * Extract readable text from an uploaded file by extension. Dispatcher keeps
 * each format's parsing isolated (SRP); ingest.ts switches on file_ext.
 */
export async function extractFileText(buf: Uint8Array, ext: string): Promise<string> {
  switch (ext.toLowerCase()) {
    case "pdf":
      return extractPdfText(buf)
    case "docx":
      return extractDocxText(buf)
    case "epub":
      return extractEpubText(buf)
    case "html":
      return htmlToText(new TextDecoder().decode(buf))
    case "txt":
    case "md":
      return new TextDecoder().decode(buf).trim()
    default:
      throw new Error(`Desteklenmeyen dosya türü: ${ext}`)
  }
}
