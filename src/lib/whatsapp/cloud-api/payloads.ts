/**
 * Pure builders for WhatsApp Cloud API message payloads.
 *
 * Split from `client.ts` on purpose: that file owns credentials and fetch and
 * is `server-only`, while the exact JSON we hand Meta is worth asserting in a
 * unit test. Every Meta limit is enforced here — callers pass intent, these
 * functions clamp it into something Graph will accept. The numbers themselves
 * live in `./limits`, with their source beside them.
 */

import {
  BUTTON_BODY_MAX,
  BUTTON_TITLE_MAX,
  CAROUSEL_BODY_MAX,
  CAROUSEL_BUTTON_TEXT_MAX,
  CAROUSEL_CARD_BODY_MAX,
  CAROUSEL_CARD_LINE_BREAK_MAX,
  CAROUSEL_CARD_MAX,
  CAROUSEL_REPLY_MAX,
  CTA_BODY_MAX,
  CTA_TEXT_MAX,
  FOOTER_TEXT_MAX,
  HEADER_TEXT_MAX,
  LIST_BODY_MAX,
  LIST_BUTTON_TEXT_MAX,
  LIST_ROW_DESCRIPTION_MAX,
  LIST_ROW_MAX,
  LIST_ROW_TITLE_MAX,
  LIST_SECTION_MAX,
  LIST_SECTION_TITLE_MAX,
  LOCATION_ADDRESS_MAX,
  LOCATION_NAME_MAX,
  LOCATION_REQUEST_BODY_MAX,
  QUICK_REPLY_ID_MAX,
  REPLY_BUTTON_MAX,
  TEXT_BODY_MAX,
} from "./limits"

export * from "./limits"

export function clamp(value: string, max: number): string {
  const text = value.trim()
  return text.length > max ? text.slice(0, max) : text
}

/**
 * Strip WhatsApp's formatting marks.
 *
 * Body text renders them; the chrome around an interactive message does not.
 * A row description written as `*3.750 TL* ~4.125 TL~` arrives with the
 * asterisks and tildes visible, so the one place that teaches the model to
 * emphasise a discounted price is also the place that breaks a list row. The
 * marks are removed here rather than forbidden upstream, because the model has
 * no way to know which field it is filling.
 */
export function plain(value: string): string {
  return value.replace(/[*_~`]/g, "").replace(/\s{2,}/g, " ").trim()
}

/** One selectable option, transport-agnostic. */
export interface ChoiceOption {
  /** Stable id echoed back in the webhook when the customer picks this. */
  id: string
  label: string
  /** Only rendered by the list transport; buttons have no room for it. */
  description?: string | null
  /** Optional grouping label; any group turns the list into sections. */
  group?: string | null
}

/** Optional text header/footer shared by the interactive message types. */
export interface InteractiveTrimmings {
  headerText?: string | null
  footerText?: string | null
}

/** Header/footer as Meta expects them, present only when set. */
export interface InteractiveDressing {
  header?: { type: "text"; text: string }
  footer?: { text: string }
}

export function trimmings(params: InteractiveTrimmings): InteractiveDressing {
  const out: InteractiveDressing = {}
  const header = params.headerText?.trim()
  const footer = params.footerText?.trim()
  if (header) {
    out.header = { type: "text" as const, text: clamp(plain(header), HEADER_TEXT_MAX) }
  }
  if (footer) out.footer = { text: clamp(plain(footer), FOOTER_TEXT_MAX) }
  return out
}

export function buildTextPayload(to: string, body: string) {
  // Clamped like everything else: a reply over 4096 characters is refused by
  // Graph outright, and losing the tail beats losing the message.
  return {
    to,
    type: "text",
    text: { body: clamp(body, TEXT_BODY_MAX), preview_url: true },
  } as const
}

/**
 * How Meta should get the picture: a public URL it downloads at send time, or
 * the id of media we already uploaded. The id form skips the download and is
 * what makes a repeat send fast.
 */
export type ImageSource = { link: string } | { id: string }

export function buildImagePayload(
  to: string,
  source: ImageSource,
  caption: string
) {
  return {
    to,
    type: "image",
    image: caption.trim() ? { ...source, caption } : { ...source },
  }
}

/**
 * Make every label in a set distinct.
 *
 * Meta refuses a message whose buttons repeat a label ("Must be unique if using
 * multiple buttons"), and two options can collide after clamping even when the
 * model wrote them differently — "Standart Çift Kişilik Oda" and "Standart Çift
 * Kişilik Suit" are the same twenty characters. A numbered suffix is ugly; a
 * rejected message is worse, and it fails for the whole reply rather than the
 * one button.
 */
function distinctTitles(labels: string[], max: number): string[] {
  const seen = new Set<string>()
  return labels.map((label) => {
    if (!seen.has(label)) {
      seen.add(label)
      return label
    }
    for (let n = 2; ; n++) {
      const suffix = ` ${n}`
      const candidate = `${label.slice(0, max - suffix.length).trim()}${suffix}`
      if (!seen.has(candidate)) {
        seen.add(candidate)
        return candidate
      }
    }
  })
}

export function buildReplyButtonsPayload(
  to: string,
  body: string,
  options: ChoiceOption[],
  extra: InteractiveTrimmings = {}
) {
  const used = options.slice(0, REPLY_BUTTON_MAX)
  const titles = distinctTitles(
    used.map((option) => clamp(plain(option.label), BUTTON_TITLE_MAX)),
    BUTTON_TITLE_MAX
  )

  return {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      ...trimmings(extra),
      body: { text: clamp(body, BUTTON_BODY_MAX) },
      action: {
        buttons: used.map((option, index) => ({
          type: "reply",
          reply: { id: option.id, title: titles[index] as string },
        })),
      },
    },
  }
}

export function buildListPayload(
  to: string,
  body: string,
  buttonLabel: string,
  options: ChoiceOption[],
  extra: InteractiveTrimmings & {
    /**
     * Heading for a group the model left unnamed. Meta documents the section
     * title as **required**, so every section gets one — the caller supplies
     * this in the customer's language rather than us inventing Turkish.
     */
    sectionTitleFallback?: string
  } = {}
) {
  const rows = options.slice(0, LIST_ROW_MAX)

  const grouped = new Map<string, ChoiceOption[]>()
  for (const option of rows) {
    const key = option.group?.trim() || ""
    const bucket = grouped.get(key)
    if (bucket) bucket.push(option)
    else grouped.set(key, [option])
  }

  const sections = Array.from(grouped.entries())
    .slice(0, LIST_SECTION_MAX)
    .map(([title, groupRows]) => ({
      // Meta documents this as required — "Section title text. Required." — so
      // it is always written, even for a single group the model left unnamed.
      title: clamp(
        plain(title || extra.sectionTitleFallback || buttonLabel),
        LIST_SECTION_TITLE_MAX
      ),
      rows: groupRows.map((option) => ({
        id: option.id,
        title: clamp(plain(option.label), LIST_ROW_TITLE_MAX),
        ...(option.description?.trim()
          ? {
              description: clamp(
                plain(option.description),
                LIST_ROW_DESCRIPTION_MAX
              ),
            }
          : {}),
      })),
    }))

  return {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      ...trimmings(extra),
      body: { text: clamp(body, LIST_BODY_MAX) },
      action: {
        button: clamp(plain(buttonLabel), LIST_BUTTON_TEXT_MAX),
        sections,
      },
    },
  }
}

/**
 * One button on a card.
 *
 * `url` decides what it *is*: a link opens the browser, anything else answers
 * back into the conversation. Meta will not mix the two on a card, so the
 * distinction is resolved for the whole message in `buildCarouselPayload`.
 */
export interface CarouselButton {
  label: string
  /** Opens in the browser when tapped. */
  url?: string | null
  /** Echoed back in the webhook when a reply button is tapped. */
  id?: string | null
}

/**
 * One card in a media carousel: a picture, a line about it, and its buttons.
 *
 * Transport-agnostic, like `ChoiceOption`.
 */
export interface CarouselCard {
  /**
   * Public URL of the picture above the card. Meta downloads it at send time;
   * unlike every other message type, a carousel header cannot use a media id.
   */
  imageUrl: string
  /** Optional line under the picture. Formatting marks render here. */
  body?: string | null
  /** One link button, or one to two reply buttons. Never a mix. */
  buttons: CarouselButton[]
}

/**
 * Close any emphasis the cut left hanging.
 *
 * A card body ends up holding a discounted price — `*23.187 TL* ~25.764 TL~` —
 * and a trim that lands between a mark and its partner turns the survivor into
 * a literal asterisk or tilde on the guest's screen. Dropping the orphan is
 * cheaper than the alternative and cannot itself unbalance anything.
 */
function balanceMarks(value: string): string {
  let out = value
  for (const mark of ["*", "_", "~"]) {
    const count = out.split(mark).length - 1
    if (count % 2 === 1) {
      const last = out.lastIndexOf(mark)
      out = out.slice(0, last) + out.slice(last + 1)
    }
  }
  return out
}

/**
 * Trim a card body to Meta's two limits at once.
 *
 * Length is the obvious one; the line-break cap is not. Three paragraphs is a
 * rejected message, not a squashed card, so surplus breaks become spaces before
 * the text is measured — clamping first would leave a break count that depends
 * on where the cut landed.
 *
 * What is left is then trimmed at a word boundary rather than mid-word: these
 * cards carry room names and prices, and "Standart Çift Kişi" is worse than one
 * fact fewer. The separator or emphasis mark stranded by that cut goes too.
 */
export function fitCardBody(value: string): string {
  let seen = 0
  const collapsed = value
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/\n/g, () => (seen++ < CAROUSEL_CARD_LINE_BREAK_MAX ? "\n" : " "))
    .trim()

  if (collapsed.length <= CAROUSEL_CARD_BODY_MAX) return collapsed

  const cut = collapsed.slice(0, CAROUSEL_CARD_BODY_MAX)
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"))
  const atWord = lastBreak > 0 ? cut.slice(0, lastBreak) : cut
  return balanceMarks(atWord.replace(/[\s·,;:\-–—]+$/, ""))
}

/**
 * Horizontally scrollable cards, each with its own picture and buttons.
 *
 * Meta's hard rule is uniformity: the button type and the button *count* must
 * be identical on every card, or the whole message is rejected. Neither is
 * something a caller can guarantee per card, so both are settled here, once,
 * for the message:
 *
 *  - Link mode needs every card to carry exactly one button and that button to
 *    have a URL. One card short and the message could not be sent at all.
 *  - Otherwise every button is a reply, and the count is the lowest any card
 *    offers — trimming a card's extra button keeps the message sendable, while
 *    inventing one for the card that lacks it would put a button on screen with
 *    nothing behind it.
 *
 * The caller still owns the card count: fewer than `CAROUSEL_CARD_MIN` is not a
 * carousel and this builder cannot invent one.
 */
export function buildCarouselPayload(
  to: string,
  body: string,
  cards: CarouselCard[]
) {
  const used = cards.slice(0, CAROUSEL_CARD_MAX)

  const asLinks = used.every(
    (card) => card.buttons.length === 1 && Boolean(card.buttons[0]?.url?.trim())
  )
  const replyCount = Math.min(
    CAROUSEL_REPLY_MAX,
    ...used.map((card) => Math.max(1, card.buttons.length))
  )

  const buttonTitle = (button: CarouselButton | undefined, fallback: string) =>
    clamp(plain(button?.label || fallback), CAROUSEL_BUTTON_TEXT_MAX)

  /** Two buttons on one card may not share a label, same rule as elsewhere. */
  const cardTitles = (card: CarouselCard, index: number) =>
    distinctTitles(
      card.buttons
        .slice(0, replyCount)
        .map((button, position) =>
          buttonTitle(button, `Seç ${index + 1}.${position + 1}`)
        ),
      CAROUSEL_BUTTON_TEXT_MAX
    )

  return {
    to,
    type: "interactive",
    interactive: {
      // No header, footer or trimmings: Meta supports none of them on a
      // carousel, and sending one rejects the message.
      type: "carousel",
      body: { text: clamp(body, CAROUSEL_BODY_MAX) },
      action: {
        cards: used.map((card, index) => ({
          card_index: index,
          // Verbatim from Meta's reference, which uses `cta_url` for the
          // quick-reply example too. The button shape below carries the type.
          type: "cta_url",
          header: { type: "image", image: { link: card.imageUrl } },
          ...(card.body?.trim()
            ? { body: { text: fitCardBody(card.body) } }
            : {}),
          action: asLinks
            ? {
                name: "cta_url",
                parameters: {
                  display_text: buttonTitle(card.buttons[0], "Link"),
                  url: card.buttons[0]?.url as string,
                },
              }
            : {
                buttons: card.buttons
                  .slice(0, replyCount)
                  .map((button, position) => ({
                    type: "quick_reply",
                    quick_reply: {
                      id: clamp(
                        button.id || `card_${index}_${position}`,
                        QUICK_REPLY_ID_MAX
                      ),
                      title: cardTitles(card, index)[position] as string,
                    },
                  })),
              },
        })),
      },
    },
  }
}

/** A pin on the map: where something is, not a question about where they are. */
export interface LocationPin {
  latitude: number
  longitude: number
  /** What the place is called. Shown in bold above the address. */
  name?: string | null
  /** Street address, shown under the name. */
  address?: string | null
}

/**
 * Send a place. Meta wants the coordinates as strings in decimal degrees, and
 * they are what actually opens in the customer's map app — the name and address
 * are labels on the pin, not the pin itself.
 */
export function buildLocationPayload(to: string, pin: LocationPin) {
  const name = pin.name?.trim()
  const address = pin.address?.trim()

  return {
    to,
    type: "location",
    location: {
      latitude: String(pin.latitude),
      longitude: String(pin.longitude),
      // Meta states no maximum for either label; these caps are ours, so the
      // pin stays readable on a phone. See `limits.ts`.
      ...(name ? { name: clamp(plain(name), LOCATION_NAME_MAX) } : {}),
      ...(address
        ? { address: clamp(plain(address), LOCATION_ADDRESS_MAX) }
        : {}),
    },
  }
}

export function buildLocationRequestPayload(to: string, body: string) {
  return {
    to,
    type: "interactive",
    interactive: {
      type: "location_request_message",
      body: { text: clamp(body, LOCATION_REQUEST_BODY_MAX) },
      action: { name: "send_location" },
    },
  }
}

export function buildCtaUrlPayload(
  to: string,
  body: string,
  buttonLabel: string,
  url: string,
  extra: InteractiveTrimmings & {
    /**
     * Picture above the body. Only `cta_url` takes a media header — a list
     * message's header must be text, so this deliberately lives here rather
     * than in `trimmings`, where it could be attached to something Meta would
     * reject.
     */
    headerImage?: ImageSource | null
  } = {}
) {
  const dressing = trimmings(extra)
  // A media header replaces a text one; Meta allows exactly one header.
  const header = extra.headerImage
    ? { header: { type: "image" as const, image: extra.headerImage } }
    : dressing.header
      ? { header: dressing.header }
      : {}

  return {
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      ...header,
      ...(dressing.footer ? { footer: dressing.footer } : {}),
      body: { text: clamp(body, CTA_BODY_MAX) },
      action: {
        name: "cta_url",
        parameters: {
          display_text: clamp(plain(buttonLabel), CTA_TEXT_MAX),
          url,
        },
      },
    },
  }
}
