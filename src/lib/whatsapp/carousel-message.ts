/**
 * Shared reader for the `show_carousel` tool result.
 *
 * Same contract as `choice-message`: the dashboard preview and the WhatsApp
 * sender build their bubble from this one pure function, so what staff see in
 * the preview is what the customer gets. No I/O, no server-only imports.
 */

import {
  CAROUSEL_CARD_MAX,
  CAROUSEL_CARD_MIN,
  CAROUSEL_REPLY_MAX,
} from "@/lib/whatsapp/cloud-api/payloads"

export interface CarouselButtonView {
  label: string
  /** Opens the browser. Present on every button of every card, or on none. */
  url?: string
  /** Comes back in the webhook when this button is tapped. */
  id?: string
}

export interface CarouselCardView {
  /** Public picture URL. A card without one cannot be sent at all. */
  imageUrl: string
  body?: string
  buttons: CarouselButtonView[]
  /** Stable handle for React keys and for naming this card's buttons. */
  id?: string
}

export interface CarouselMessage {
  type: "carousel"
  body: string
  cards: CarouselCardView[]
}

export { CAROUSEL_CARD_MAX, CAROUSEL_CARD_MIN, CAROUSEL_REPLY_MAX }

/** Marks a reply id this app minted, so a tap can be read back as words. */
export const CARD_TAP_PREFIX = "card:"

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * What to call this card in a tap that comes back to us.
 *
 * Taken from the first thing the body says — "*Suit* · 2 Kişi · 35 m²" is a
 * suite — because that is the name the guest just read, and asking the model
 * for it a second time would be a field it has to keep in sync with the body.
 */
export function cardName(body: string | undefined, fallback: string): string {
  const firstLine = (body ?? "").split("\n")[0] ?? ""
  const firstPart = firstLine.split(/[·|•]/)[0] ?? ""
  const cleaned = firstPart.replace(/[*_~`]/g, "").trim()
  return cleaned || fallback
}

/**
 * Encode a tap so the webhook can turn it back into a sentence.
 *
 * Every card in a room carousel carries the same two labels — "Detaylar",
 * "Seç" — so a tap identified by its label alone says nothing about which room
 * was tapped. The id is ours to shape and Meta hands it straight back, so the
 * card's name travels inside it.
 */
export function encodeCardTap(name: string, label: string): string {
  return `${CARD_TAP_PREFIX}${name}|${label}`
}

/** The words behind a tap id, or null when it is not one of ours. */
export function decodeCardTap(
  id: string | undefined | null
): { name: string; label: string } | null {
  if (!id || !id.startsWith(CARD_TAP_PREFIX)) return null
  const [name, ...rest] = id.slice(CARD_TAP_PREFIX.length).split("|")
  const label = rest.join("|").trim()
  if (!name?.trim() || !label) return null
  return { name: name.trim(), label }
}

function readButtons(value: unknown): CarouselButtonView[] {
  if (!Array.isArray(value)) return []
  const out: CarouselButtonView[] = []
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue
    const record = entry as Record<string, unknown>
    const label = str(record.label)
    if (!label) continue
    const url = str(record.url)
    const id = str(record.id)
    out.push({ label, ...(url ? { url } : {}), ...(id ? { id } : {}) })
    if (out.length >= CAROUSEL_REPLY_MAX) break
  }
  return out
}

function readCards(value: unknown): CarouselCardView[] {
  if (!Array.isArray(value)) return []
  const out: CarouselCardView[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "object" || entry === null) continue
    const record = entry as Record<string, unknown>
    const imageUrl = str(record.imageUrl)
    const buttons = readButtons(record.buttons)
    // A card is a picture with something to tap. Missing either one is not a
    // card we can render, and dropping it beats sending a carousel Meta
    // will refuse.
    if (!imageUrl || buttons.length === 0) continue
    const body = str(record.body)
    out.push({
      imageUrl,
      buttons,
      ...(body ? { body } : {}),
      id: str(record.id) || `card_${index}`,
    })
    if (out.length >= CAROUSEL_CARD_MAX) break
  }
  return out
}

/**
 * Build a carousel bubble from a `show_carousel` tool result, or null when it
 * cannot become one.
 *
 * Null is the honest answer for a single usable card: Meta's floor is two, and
 * quietly reshaping the model's intent into a different message type would hide
 * the fact that the tool was called with too little to work with.
 */
export function toCarouselMessage(
  output: Record<string, unknown> | null | undefined
): CarouselMessage | null {
  if (!output) return null
  const body = str(output.body)
  const cards = readCards(output.cards)
  if (!body || cards.length < CAROUSEL_CARD_MIN) return null

  return { type: "carousel", body, cards }
}

/**
 * Read a tap against the message it came from.
 *
 * The id alone is enough for a carousel this version sent — the card's name is
 * inside it. This is the answer for everything else: a card sent before that
 * existed, an id we did not mint, a list row. WhatsApp tells us which message
 * was replied to, we stored what we put in it, so the option can be looked up
 * rather than guessed. Without this, four cards offering "Detaylar" produce
 * four identical taps and the assistant has to ask which room they meant.
 *
 * Pure: the caller fetches `richContent`, this decides what the tap said.
 */
export function tapTextFromRichContent(
  richContent: unknown,
  reply: { id?: string | null; title?: string | null }
): string | null {
  const replyId = str(reply.id)
  const title = str(reply.title)
  if (!Array.isArray(richContent) || !replyId) return null

  for (const entry of richContent) {
    if (typeof entry !== "object" || entry === null) continue
    const message = entry as Record<string, unknown>

    if (message.type === "carousel" && Array.isArray(message.cards)) {
      for (const [index, raw] of message.cards.entries()) {
        if (typeof raw !== "object" || raw === null) continue
        const card = raw as Record<string, unknown>
        const buttons = Array.isArray(card.buttons) ? card.buttons : []

        for (const [position, rawButton] of buttons.entries()) {
          const button =
            typeof rawButton === "object" && rawButton !== null
              ? (rawButton as Record<string, unknown>)
              : {}
          const label = str(button.label)
          // Three ways the same button can be named: the id we minted, the id
          // the payload builder fell back to, and the card's own id from the
          // days when a card had a single button.
          const matches =
            str(button.id) === replyId ||
            replyId === `card_${index}_${position}` ||
            (replyId === str(card.id) && (!title || label === title))
          if (!matches) continue
          const name = cardName(str(card.body), `Seçenek ${index + 1}`)
          return `${name} — ${label || title}`.trim()
        }
      }
    }

    if (message.type === "choice" && Array.isArray(message.options)) {
      for (const raw of message.options) {
        if (typeof raw !== "object" || raw === null) continue
        const option = raw as Record<string, unknown>
        if (str(option.id) !== replyId) continue
        return str(option.label) || title || null
      }
    }
  }

  return null
}

/**
 * How the cards will be tapped: every card links out, or none of them do.
 *
 * Meta requires one button type across the whole message, so a set where only
 * some cards carry links degrades to replies — the links would otherwise make
 * the message unsendable.
 */
export function carouselButtons(
  cards: CarouselCardView[]
): "links" | "replies" {
  return cards.every(
    (card) => card.buttons.length === 1 && Boolean(card.buttons[0]?.url)
  )
    ? "links"
    : "replies"
}
