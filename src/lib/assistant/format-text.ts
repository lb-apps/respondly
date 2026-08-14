/**
 * Normalize assistant output to plain chat text.
 *
 * Strips Markdown the UI and WhatsApp cannot render. Maps supported emphasis
 * to WhatsApp-compatible syntax (*bold*, _italic_, ~strike~) so replies look
 * the same in the dashboard preview and on WhatsApp.
 */

const HTTP_URL_RE = /https?:\/\/[^\s<>"')\]]+/gi

const IMAGE_EXT_RE = /\.(?:jpg|jpeg|png|gif|webp|bmp|svg|avif)(?:$|[?#])/i

function trimUrlTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/, "")
}

function normalizeUrl(url: string): string {
  return trimUrlTrailingPunctuation(url).replace(/\/$/, "").toLowerCase()
}

function urlsEquivalent(a: string, b: string): boolean {
  const na = normalizeUrl(a)
  const nb = normalizeUrl(b)
  return na === nb || na.startsWith(nb) || nb.startsWith(na)
}

/** Heuristic: does this URL point at an image we can render? */
function isLikelyImageUrl(url: string): boolean {
  const clean = trimUrlTrailingPunctuation(url).toLowerCase()
  if (IMAGE_EXT_RE.test(clean)) return true
  // Supabase public storage objects (e.g. knowledge-images bucket).
  if (clean.includes("/storage/v1/object/public/")) return true
  return false
}

/**
 * Pull raw image URLs the model pasted into the text so callers can render them
 * as real images and remove the bare links. Trailing punctuation is trimmed.
 */
export function extractImageUrls(text: string): string[] {
  if (!text) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(HTTP_URL_RE)) {
    const url = trimUrlTrailingPunctuation(match[0])
    if (isLikelyImageUrl(url) && !seen.has(url)) {
      seen.add(url)
      out.push(url)
    }
  }
  return out
}

export type AssistantRichUrlSource = {
  type: string
  imageUrl?: string
  url?: string
  /** Only present on messages stored before captions were dropped. */
  caption?: string
  /** Carousel cards, each carrying its own picture and link. */
  cards?: { imageUrl?: string; url?: string }[]
  /** The line the component renders itself — a button's, a question's. */
  body?: string
}

export function collectEmbodiedUrls(rich: AssistantRichUrlSource[]): string[] {
  const urls: string[] = []
  for (const item of rich) {
    if (item.type === "image" && item.imageUrl) urls.push(item.imageUrl)
    if (item.type === "cta" && item.url) urls.push(item.url)
    if (item.type === "carousel") {
      // Every card is a picture *and* a link the customer can tap, so both
      // count as already delivered and must not be repeated in the text.
      for (const card of item.cards ?? []) {
        if (card.imageUrl) urls.push(card.imageUrl)
        if (card.url) urls.push(card.url)
      }
    }
  }
  return urls
}

export function richContentHidesRawUrls(rich: AssistantRichUrlSource[]): boolean {
  return rich.some(
    (item) =>
      item.type === "image" || item.type === "cta" || item.type === "carousel"
  )
}

/**
 * Remove http(s) URLs from assistant text. Raw links never belong in a chat
 * bubble: images are rendered as media, action links as buttons. By default
 * every http(s) URL is stripped; pass stripAllHttpUrls=false to only remove
 * links that are already shown elsewhere.
 */
export function stripRedundantAssistantUrls(
  text: string,
  embodiedUrls: string[],
  options?: { stripAllHttpUrls?: boolean }
): string {
  if (!text.trim()) return text

  const stripAll = options?.stripAllHttpUrls ?? true

  const shouldRemove = (match: string): boolean => {
    if (embodiedUrls.some((u) => urlsEquivalent(match, u))) return true
    return stripAll
  }

  let s = text.replace(HTTP_URL_RE, (match) => (shouldRemove(match) ? "" : match))

  // Tidy leftovers from removed links: empty parens, dangling label colons,
  // trailing whitespace, and collapsed blank lines.
  s = s.replace(/\s*\(\s*\)/g, "")
  s = s.replace(/[ \t]*[:：]\s*$/gm, "")
  s = s.replace(/^[ \t•\-–]*$/gm, "")
  s = s.replace(/[ \t]+\n/g, "\n")
  s = s.replace(/\n{3,}/g, "\n\n")

  return s.trim()
}

/**
 * Repair sentences glued together by a multi-step turn.
 *
 * When the model writes text before a tool call and again after it, the two
 * parts arrive as one string with nothing between them — "…hazırlıyorum." and
 * "Bağlantıyı hazırladım." become "…hazırlıyorum.Bağlantıyı hazırladım.". The
 * customer sees a typo we produced, not the model.
 *
 * Only a sentence end followed straight away by a capital letter is repaired.
 * That leaves decimals ("1.500"), times ("18:00") and ordinals alone, because
 * what follows them is never an upper-case letter.
 */
function separateGluedSentences(text: string): string {
  return text.replace(/([.!?])(\p{Lu})/gu, "$1 $2")
}

/**
 * Format assistant reply text for display.
 *
 * Raw http(s) URLs always go: images render as media and action links as
 * buttons, so a bare URL in the bubble is never right.
 *
 * What this deliberately no longer does is edit the model's sentences. It used
 * to delete image captions and source titles wherever they appeared, which in
 * Turkish cut nouns out of the middle of a clause and left the suffixes behind
 * — "İşte Standart İki Yataklı Oda'dan birkaç fotoğraf" reached a guest as
 * "İşte 'dan birkaç". The duplication that rule existed to prevent is gone at
 * the source: we no longer attach captions at all.
 */
/** Comparable form: no emphasis, no punctuation, no case, no double spaces. */
function comparable(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[*_~`]/g, "")
    .replace(/[.,;:!?…·—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Drop reply text that a rich message is already saying.
 *
 * A button carries its own line, and the model keeps writing that same line as
 * its reply as well — the customer then reads the sentence once in a bubble and
 * again above the button. The instructions say not to; this is what makes it
 * true. Only an exact echo is removed, or one the body wholly contains: text
 * that adds anything of its own is left alone, duplication and all, because
 * cutting a sentence that was half new is the worse failure.
 */
export function dropTextEchoedByRichContent(
  text: string,
  rich: AssistantRichUrlSource[]
): string {
  const needle = comparable(text)
  if (!needle) return text

  for (const item of rich) {
    const body = comparable(item.body ?? "")
    if (body && (body === needle || body.includes(needle))) return ""
  }
  return text
}

export function formatAssistantMessageText(
  text: string,
  rich: AssistantRichUrlSource[]
): string {
  const formatted = separateGluedSentences(formatAssistantText(text))
  const withoutUrls = stripRedundantAssistantUrls(
    formatted,
    collectEmbodiedUrls(rich),
    { stripAllHttpUrls: true }
  )
  return dropTextEchoedByRichContent(withoutUrls, rich)
}

/** Strip Markdown and map supported styles to plain-chat / WhatsApp syntax. */
export function formatAssistantText(text: string): string {
  let s = text.replace(/\r\n/g, "\n")

  const codeBlocks: string[] = []
  s = s.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
    const token = `\u0000CODE${codeBlocks.length}\u0000`
    codeBlocks.push(`\`\`\`${code.trim()}\`\`\``)
    return token
  })

  s = s.replace(/`([^`\n]+)`/g, "`$1`")
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
  s = s.replace(/__([^_\n]+)__/g, "*$1*")
  s = s.replace(/~~([^~\n]+)~~/g, "~$1~")
  s = s.replace(/^#{1,6}\s+/gm, "")
  s = s.replace(/^[\t ]*[-*+]\s+/gm, "• ")
  s = s.replace(/^[\t ]*\d+\.\s+/gm, "• ")
  s = s.replace(/^>\s?/gm, "")
  s = s.replace(/^[-*_]{3,}\s*$/gm, "")

  for (let i = 0; i < codeBlocks.length; i++) {
    s = s.replace(`\u0000CODE${i}\u0000`, codeBlocks[i]!)
  }

  s = s.replace(/\n{3,}/g, "\n\n")

  return s.trim()
}
