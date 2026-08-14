/**
 * Whole-site crawl backend for "link" knowledge sources.
 *
 * Delegates page rendering + markdown extraction to a self-hosted Crawl4AI
 * service (Docker, Apache-2.0) reached over HTTP. We own the crawl ORCHESTRATION
 * here — a same-origin BFS capped at MAX_PAGES — so the cost ceiling and
 * link-following rules live in our code (testable, no fragile remote config),
 * while Crawl4AI does what it is good at: render JS-heavy pages (Wix/SPA) and
 * return clean markdown + discovered links.
 *
 * Disabled (returns null / false) when CRAWL4AI_BASE_URL is unset, so the app
 * degrades gracefully to the single-page Jina/direct fetch in extract.ts.
 */

import type { CrawlConfig, CrawlMode } from "@/types/database"

// Env values are DEFAULTS now (the Add-URL dialog can override per-source),
// but every request is still clamped to the hard ceilings below to bound cost.
const DEFAULT_MAX_PAGES = Number(process.env.CRAWL4AI_MAX_PAGES) || 50
const DEFAULT_MAX_DEPTH = Number(process.env.CRAWL4AI_MAX_DEPTH) || 2
const HARD_MAX_PAGES = 10_000
const HARD_MAX_DEPTH = 5
// Per-batch URL count sent to Crawl4AI in one /crawl call (it batches them).
const BATCH_SIZE = 10

export function isCrawlEnabled(): boolean {
  return Boolean(process.env.CRAWL4AI_BASE_URL)
}

interface CrawlPage {
  url: string
  markdown: string
  internalLinks: string[]
}

/** Skip asset/binary URLs a markdown crawl can't use. */
const SKIP_EXT = /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|mp4|webm|mp3|zip|woff2?|ttf)(\?|#|$)/i

/** Normalize for the visited-set: drop hash, trailing slash, default ports. */
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    u.hash = ""
    u.search = "" // dedupe ?utm=… and pagination noise; keep crawl tight
    let s = u.toString()
    if (s.endsWith("/")) s = s.slice(0, -1)
    return s
  } catch {
    return null
  }
}

/** Bare host, www-stripped — so apex ↔ www count as the same site. */
function siteHost(u: string): string {
  return new URL(u).hostname.replace(/^www\./i, "")
}

/**
 * Same-site test, protocol- and www-insensitive. Sites commonly redirect apex→
 * www (or vice-versa) and link internally with the canonical host; a strict
 * origin check would then drop every internal link when the seed URL uses the
 * other host. Comparing the www-stripped hostname keeps the crawl on-site
 * without wandering to external domains.
 */
function sameSite(a: string, b: string): boolean {
  try {
    return siteHost(a) === siteHost(b)
  } catch {
    return false
  }
}

type RawResult = {
  url?: string
  success?: boolean
  markdown?: string | { raw_markdown?: string; fit_markdown?: string }
  links?: { internal?: Array<{ href?: string } | string> }
}

/**
 * Strip the boilerplate raw_markdown carries (image embeds + bare CDN URLs +
 * Wix zero-width chars + repeated newsletter lines). fit_markdown would be
 * pre-pruned, but the minimal /crawl request leaves it empty — so we prune
 * here. Keeps text content + real links; drops noise that dilutes embeddings.
 */
function cleanMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // ![alt](img) embeds
    .replace(/^\s*https?:\/\/\S+\s*$/gim, "") // bare URL-only lines (CDN assets)
    .replace(/​/g, "") // Wix zero-width spaces
    .replace(/^\s*(top of page|bottom of page)\s*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function pickMarkdown(md: RawResult["markdown"]): string {
  if (!md) return ""
  const raw = typeof md === "string" ? md : md.fit_markdown || md.raw_markdown || ""
  return cleanMarkdown(raw)
}

/** One /crawl call for a batch of URLs. Failures yield no page (skipped). */
async function crawlBatch(urls: string[]): Promise<CrawlPage[]> {
  const base = process.env.CRAWL4AI_BASE_URL!.replace(/\/$/, "")
  const token = process.env.CRAWL4AI_API_TOKEN

  const res = await fetch(`${base}/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ urls }),
  })
  if (!res.ok) {
    throw new Error(`Crawl4AI HTTP ${res.status}`)
  }

  const data = (await res.json()) as { results?: RawResult[] }
  const results = data.results ?? []

  return results
    .filter((r) => r.success !== false && r.url)
    .map((r) => {
      const internal = (r.links?.internal ?? [])
        .map((l) => (typeof l === "string" ? l : l.href))
        .filter((h): h is string => Boolean(h))
      return {
        url: r.url!,
        markdown: pickMarkdown(r.markdown),
        internalLinks: internal,
      }
    })
}

/**
 * Translate a user glob (e.g. a "blog" or "info" path pattern) to a RegExp
 * matched against the full URL. Star → any chars, question mark → one char;
 * everything else escaped. Empty pattern → null (match all).
 */
function globToRegExp(pattern: string): RegExp | null {
  const p = pattern.trim()
  if (!p) return null
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")
  try {
    return new RegExp(escaped)
  } catch {
    return null
  }
}

/** Aggregate crawled pages into one markdown doc, each prefixed by its path. */
function aggregate(pages: CrawlPage[]): string {
  if (pages.length === 0) return ""
  return pages
    .map((p) => {
      const path = (() => {
        try {
          return new URL(p.url).pathname || "/"
        } catch {
          return p.url
        }
      })()
      return `## ${path}\n\n${p.markdown}`
    })
    .join("\n\n---\n\n")
    .trim()
}

/** Crawl URLs in BATCH_SIZE chunks (no link-following). Failures skipped. */
async function crawlMany(urls: string[]): Promise<CrawlPage[]> {
  const pages: CrawlPage[] = []
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    try {
      const batch = await crawlBatch(urls.slice(i, i + BATCH_SIZE))
      for (const page of batch) if (page.markdown) pages.push(page)
    } catch {
      // Batch failed (service down/timeout) — skip, keep what we have.
    }
  }
  return pages
}

/**
 * Fetch sitemap URLs from `${origin}/sitemap.xml`, following nested sitemaps one
 * level (sitemap-index). Returns same-site <loc> URLs, optional glob-filtered,
 * capped at maxUrls. Best-effort — returns [] on any failure.
 */
async function fetchSitemapUrls(
  root: string,
  re: RegExp | null,
  maxUrls: number
): Promise<string[]> {
  const origin = new URL(root).origin
  const seen = new Set<string>()
  const out: string[] = []

  async function load(sitemapUrl: string, allowNested: boolean): Promise<void> {
    if (out.length >= maxUrls) return
    let xml: string
    try {
      const res = await fetch(sitemapUrl, { redirect: "follow" })
      if (!res.ok) return
      xml = await res.text()
    } catch {
      return
    }
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
    const isIndex = /<sitemapindex/i.test(xml)
    if (isIndex && allowNested) {
      for (const loc of locs) {
        if (out.length >= maxUrls) break
        await load(loc, false) // one level of nesting only
      }
      return
    }
    for (const loc of locs) {
      if (out.length >= maxUrls) break
      const n = normalizeUrl(loc)
      if (!n || seen.has(n)) continue
      if (!sameSite(n, root)) continue
      if (SKIP_EXT.test(n)) continue
      if (re && !re.test(n)) continue
      seen.add(n)
      out.push(n)
    }
  }

  await load(`${origin}/sitemap.xml`, true)
  return out
}

/**
 * Crawl a URL source per the Add-URL choice and return one aggregated markdown
 * document. Modes:
 *  - single  → just the root page.
 *  - sitemap → URLs from /sitemap.xml (glob-filtered, capped), no link-following.
 *  - whole   → same-site BFS (depth/maxUrls from opts, hard-clamped); opts.pattern
 *              filters which discovered links are enqueued.
 * Each page is prefixed with its path as a heading so retrieval can ground
 * location/contact answers to the right page. Returns "" if nothing usable.
 */
export async function crawlSite(rootUrl: string, opts?: CrawlConfig): Promise<string> {
  const root = normalizeUrl(rootUrl)
  if (!root) return ""

  const mode: CrawlMode = opts?.mode ?? "whole"
  const re = globToRegExp(opts?.pattern ?? "")
  const maxUrls = Math.min(
    Math.max(1, opts?.maxUrls ?? DEFAULT_MAX_PAGES),
    HARD_MAX_PAGES
  )
  const maxDepth = Math.min(
    Math.max(0, opts?.depth ?? DEFAULT_MAX_DEPTH),
    HARD_MAX_DEPTH
  )

  if (mode === "single") {
    return aggregate(await crawlMany([root]))
  }

  if (mode === "sitemap") {
    const urls = await fetchSitemapUrls(root, re, maxUrls)
    if (urls.length === 0) return aggregate(await crawlMany([root]))
    return aggregate(await crawlMany(urls))
  }

  // whole: same-site BFS, processed in batches per level.
  const visited = new Set<string>([root])
  let frontier: Array<[string, number]> = [[root, 0]]
  const pages: CrawlPage[] = []

  while (frontier.length > 0 && pages.length < maxUrls) {
    const remaining = maxUrls - pages.length
    const slice = frontier.slice(0, remaining)
    frontier = frontier.slice(remaining)

    for (let i = 0; i < slice.length; i += BATCH_SIZE) {
      const chunk = slice.slice(i, i + BATCH_SIZE)
      const depth = chunk[0][1]
      let batch: CrawlPage[]
      try {
        batch = await crawlBatch(chunk.map(([u]) => u))
      } catch {
        // Whole batch failed (service down/timeout) — skip, keep what we have.
        continue
      }

      for (const page of batch) {
        if (page.markdown) pages.push(page)
        if (depth >= maxDepth) continue
        for (const link of page.internalLinks) {
          const n = normalizeUrl(link)
          if (!n || visited.has(n)) continue
          if (!sameSite(n, root)) continue
          if (SKIP_EXT.test(n)) continue
          // Pattern filters which discovered links are enqueued (root always in).
          if (re && !re.test(n)) continue
          visited.add(n)
          frontier.push([n, depth + 1])
        }
      }
    }
  }

  return aggregate(pages)
}
