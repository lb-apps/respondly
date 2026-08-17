"use client"

import { useState } from "react"
import { ExternalLink, List, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CarouselCards } from "@/components/chat/carousel-cards"
import { ChatImageCard } from "@/components/chat/chat-image-card"
import { Bubble, type MessageSide } from "@/components/chat/message-row"
import { WhatsAppFormattedText } from "@/components/chat/whatsapp-formatted-text"
import { extractImageUrls } from "@/lib/assistant/format-text"
import { extractMcpImages } from "@/lib/mcp/images"
import {
  choiceTransport,
  toChoiceMessage,
  type ChoiceMessage,
} from "@/lib/whatsapp/choice-message"
import {
  cardName,
  toCarouselMessage,
  type CarouselMessage,
} from "@/lib/whatsapp/carousel-message"

/**
 * Everything in a message that is not plain text — and the one place it is drawn.
 *
 * The inbox and the preview show the same conversation from opposite chairs, so
 * they must draw a carousel, a choice or a photo identically. They used to hold
 * a parser and a renderer each, and the two had already drifted: the preview
 * never showed a location the assistant sent, and the inbox threw away the
 * button label it had been given.
 *
 * The two *readers* stay separate on purpose — they genuinely read different
 * things. The inbox reads `messages.rich_content`, which is what was actually
 * delivered to WhatsApp; the preview reads the model turn's own parts, because
 * nothing has been sent yet. What was duplicated was the drawing, and that is
 * what this shares.
 */

export type RichItem =
  | { type: "image"; imageUrl: string; caption?: string }
  | ChoiceMessage
  | CarouselMessage
  | { type: "cta"; body: string; url: string; buttonLabel?: string }
  | { type: "location_request"; body: string }
  | {
      type: "location"
      latitude: number
      longitude: number
      name?: string
      address?: string
    }
  /** WhatsApp's plain reply buttons, as they were sent. */
  | { type: "quick_reply"; body: string; buttons: string[] }

/** Max images pulled out of connected-system results for one bubble. */
const MAX_TOOL_IMAGES = 4

/** Built-in tools — anything else in a turn came from a connected MCP server. */
const BUILT_IN_TOOLS = new Set([
  "search_knowledge",
  "ask_choice",
  "show_carousel",
  "request_location",
  "send_location",
  "send_link_button",
  "flag_source_conflict",
  "get_contact_profile",
  "update_contact_profile",
])

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}

// ── Readers ─────────────────────────────────────────────────────────────────

/**
 * What was delivered, read back off `messages.rich_content` — the inbox.
 *
 * Stored exactly as it was sent, so the same readers that built the message
 * rebuild it here and staff see what the customer saw.
 */
export function richFromSentContent(raw: unknown[] | null | undefined): RichItem[] {
  if (!raw) return []
  const items: RichItem[] = []

  for (const entry of raw) {
    const r = asRecord(entry)
    if (!r) continue

    if (r.type === "image" && typeof r.imageUrl === "string") {
      // Captions only exist on rows stored before they were dropped; new
      // messages send the picture on its own.
      items.push({ type: "image", imageUrl: r.imageUrl, caption: str(r.caption) })
    } else if (r.type === "quick_reply" && Array.isArray(r.buttons)) {
      items.push({
        type: "quick_reply",
        body: str(r.body) ?? "",
        buttons: (r.buttons as unknown[]).filter((b): b is string => typeof b === "string"),
      })
    } else if (r.type === "cta" && typeof r.url === "string") {
      // The label was always in the payload; the inbox used to drop it and
      // print a hardcoded one instead.
      items.push({
        type: "cta",
        body: str(r.body) ?? "",
        url: r.url,
        buttonLabel: str(r.buttonLabel),
      })
    } else if (r.type === "carousel") {
      const carousel = toCarouselMessage(r)
      if (carousel) items.push(carousel)
    } else if (r.type === "choice") {
      const choice = toChoiceMessage(r)
      if (choice) items.push(choice)
    } else if (r.type === "location_request") {
      items.push({ type: "location_request", body: str(r.body) ?? "" })
    } else if (
      r.type === "location" &&
      typeof r.latitude === "number" &&
      typeof r.longitude === "number"
    ) {
      items.push({
        type: "location",
        latitude: r.latitude,
        longitude: r.longitude,
        name: str(r.name),
        address: str(r.address),
      })
    }
  }

  return dropImagesAlreadyOnCards(items)
}

/**
 * What a turn is about to send, read off the model's own parts — the preview.
 *
 * Mirrors what the WhatsApp sender does with the same tool results, so the
 * preview shows the shape the customer would get.
 */
export function richFromModelParts(parts: unknown[]): RichItem[] {
  const rich: RichItem[] = []
  const seenUrls = new Set<string>()

  for (const part of parts) {
    const rec = asRecord(part)
    if (!rec) continue

    const type = str(rec.type) ?? ""
    let toolName = ""
    if (type === "dynamic-tool") {
      toolName = str(rec.toolName) ?? ""
    } else if (type.startsWith("tool-")) {
      toolName = type.slice("tool-".length)
    } else {
      continue
    }

    const result = asRecord(rec.output ?? rec.result)
    if (!result) continue

    if (toolName === "search_knowledge") {
      const passages = Array.isArray(result.passages) ? result.passages : []
      for (const p of passages) {
        const pr = asRecord(p)
        const url = pr ? str(pr.imageUrl) : undefined
        if (!url || seenUrls.has(url)) continue
        seenUrls.add(url)
        rich.push({ type: "image", imageUrl: url })
      }
    } else if (toolName === "ask_choice") {
      const choice = toChoiceMessage(result)
      if (choice) rich.push(choice)
    } else if (toolName === "show_carousel") {
      const carousel = toCarouselMessage(result)
      if (carousel) rich.push(carousel)
    } else if (toolName === "request_location") {
      const body = str(result.body)?.trim() ?? ""
      if (body) rich.push({ type: "location_request", body })
    } else if (toolName === "send_location") {
      // The inbox has always shown a sent location; the preview did not read
      // this tool at all, so the same turn looked different on the two screens.
      if (typeof result.latitude === "number" && typeof result.longitude === "number") {
        rich.push({
          type: "location",
          latitude: result.latitude,
          longitude: result.longitude,
          name: str(result.name),
          address: str(result.address),
        })
      }
    } else if (toolName === "send_link_button") {
      const url = str(result.url)
      const label = str(result.label)?.trim() ?? ""
      const body = str(result.body)?.trim() ?? ""
      if (url && label && body) {
        rich.push({ type: "cta", body, url, buttonLabel: label })
      }
    } else if (toolName && !BUILT_IN_TOOLS.has(toolName)) {
      // A tool from a connected MCP server. We don't know its payload shape, so
      // look for images generically and ignore everything else.
      const remaining = MAX_TOOL_IMAGES - seenUrls.size
      if (remaining > 0 && result.ok !== false) {
        for (const image of extractMcpImages(result, remaining)) {
          if (seenUrls.has(image.url)) continue
          seenUrls.add(image.url)
          rich.push({ type: "image", imageUrl: image.url })
        }
      }
    }
  }

  return dropImagesAlreadyOnCards(rich)
}

/**
 * Same rule as the WhatsApp sender: a picture that is already a carousel card is
 * not also a loose photo above it.
 */
function dropImagesAlreadyOnCards(items: RichItem[]): RichItem[] {
  const onCards = new Set(
    items.flatMap((item) =>
      item.type === "carousel" ? item.cards.map((card) => card.imageUrl) : []
    )
  )
  if (onCards.size === 0) return items
  return items.filter((item) => item.type !== "image" || !onCards.has(item.imageUrl))
}

/**
 * Render-time safety net: if the model pasted a raw image URL into its reply
 * text instead of letting a media passage render, surface it as an image so the
 * photo shows and the bare link can be stripped out of the words.
 */
export function mergeTextImages(rich: RichItem[], text: string): RichItem[] {
  const existing = new Set(
    rich
      .filter((r): r is Extract<RichItem, { type: "image" }> => r.type === "image")
      .map((r) => r.imageUrl)
  )
  const extras = extractImageUrls(text)
    .filter((url) => !existing.has(url))
    .map((url): RichItem => ({ type: "image", imageUrl: url, caption: "" }))
  return extras.length > 0 ? [...rich, ...extras] : rich
}

// ── Renderer ────────────────────────────────────────────────────────────────

interface RichContentProps {
  items: RichItem[]
  side: MessageSide
  /**
   * Whether the controls answer. In the preview the tester is the customer, so
   * tapping a reply button sends it; in the inbox these are a record of what the
   * customer was offered and pressing them would mean nothing.
   */
  onQuickReply?: (label: string) => void
  quickReplyDisabled?: boolean
}

export function RichContent({
  items,
  side,
  onQuickReply,
  quickReplyDisabled = false,
}: RichContentProps) {
  const interactive = Boolean(onQuickReply)
  const disabled = quickReplyDisabled || !onQuickReply

  return (
    <>
      {items.map((item, i) => {
        switch (item.type) {
          case "image":
            return (
              <ChatImageCard
                key={i}
                imageUrl={item.imageUrl}
                caption={item.caption}
                side={side}
              />
            )

          case "choice":
            return (
              <div key={i} className="flex flex-col gap-1.5">
                {item.body ? (
                  <Bubble side={side}>
                    <WhatsAppFormattedText text={item.body} />
                  </Bubble>
                ) : null}
                {interactive ? (
                  <ChoicePreview choice={item} disabled={disabled} onPick={onQuickReply} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {item.options.map((option) => (
                      <Pill key={option.id}>
                        {option.label}
                        {option.description ? (
                          <span className="text-muted-foreground/70">
                            {" · "}
                            {option.description}
                          </span>
                        ) : null}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            )

          case "carousel":
            return (
              <div key={i} className="w-full min-w-0">
                <CarouselCards
                  cards={item.cards}
                  renderButton={(button, card) =>
                    !interactive ? (
                      <span
                        key={button.label}
                        className="bg-card text-primary border-t px-2.5 py-2 text-center text-xs font-medium"
                      >
                        {button.label}
                      </span>
                    ) : button.url ? (
                      <a
                        key={button.label}
                        href={button.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:bg-accent border-t px-2.5 py-2 text-center text-xs font-medium"
                      >
                        {button.label}
                      </a>
                    ) : (
                      <button
                        key={button.label}
                        type="button"
                        className="text-primary hover:bg-accent border-t px-2.5 py-2 text-center text-xs font-medium disabled:opacity-60"
                        disabled={disabled}
                        onClick={
                          onQuickReply
                            ? () =>
                                onQuickReply(
                                  `${cardName(card.body, button.label)} — ${button.label}`
                                )
                            : undefined
                        }
                      >
                        {button.label}
                      </button>
                    )
                  }
                />
              </div>
            )

          case "quick_reply":
            return (
              <div key={i} className="flex flex-col gap-1.5">
                {item.body ? (
                  <Bubble side={side}>
                    <WhatsAppFormattedText text={item.body} />
                  </Bubble>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {item.buttons.map((label) =>
                    interactive ? (
                      <Button
                        key={label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        disabled={disabled}
                        onClick={() => onQuickReply?.(label)}
                      >
                        {label}
                      </Button>
                    ) : (
                      <Pill key={label}>{label}</Pill>
                    )
                  )}
                </div>
              </div>
            )

          case "cta":
            return (
              <div key={i} className="flex flex-col gap-1.5">
                {item.body ? (
                  <Bubble side={side}>
                    <WhatsAppFormattedText text={item.body} />
                  </Bubble>
                ) : null}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-fit">
                  <Button size="sm" className="gap-1.5 rounded-full text-xs">
                    {/* The label travels with the message. Older rows that
                        predate it fall back to something the product can say
                        about any link, not a hotel booking. */}
                    {item.buttonLabel || "Bağlantıyı aç"}
                    <ExternalLink className="size-3" />
                  </Button>
                </a>
              </div>
            )

          case "location_request":
            return (
              <div key={i} className="flex flex-col gap-1.5">
                {item.body ? (
                  <Bubble side={side}>
                    <WhatsAppFormattedText text={item.body} />
                  </Bubble>
                ) : null}
                <Pill>
                  <MapPin className="size-3" /> Konum isteği
                </Pill>
              </div>
            )

          case "location": {
            const label = item.name || item.address || "Konum"
            return (
              <a
                key={i}
                href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-card flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs"
              >
                <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{label}</span>
                  {item.address && item.address !== label ? (
                    <span className="text-muted-foreground line-clamp-2">{item.address}</span>
                  ) : null}
                </span>
              </a>
            )
          }

          default:
            return null
        }
      })}
    </>
  )
}

/** A read-only control: what the customer was offered, not an offer to staff. */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border/80 bg-background text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
      {children}
    </span>
  )
}

/**
 * A `ask_choice` bubble the way WhatsApp will deliver it: up to three answers
 * are tappable buttons, more sit behind a list sheet. The tester sees the real
 * shape before a customer does.
 */
function ChoicePreview({
  choice,
  disabled,
  onPick,
}: {
  choice: ChoiceMessage
  disabled: boolean
  onPick?: (label: string) => void
}) {
  const [listOpen, setListOpen] = useState(false)
  const asButtons = choiceTransport(choice.options, choice.descriptionsMatter) === "buttons"

  if (asButtons) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {choice.options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              disabled={disabled}
              onClick={onPick ? () => onPick(option.label) : undefined}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {choice.footer && <p className="text-muted-foreground text-xs">{choice.footer}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-full text-xs"
        aria-expanded={listOpen}
        onClick={() => setListOpen((open) => !open)}
      >
        <List className="size-3" />
        {choice.listButtonLabel || "Seçenekler"}
      </Button>

      {listOpen && (
        <ul className="divide-y rounded-lg border">
          {choice.options.map((option, index) => {
            // WhatsApp's list sheet groups its rows; the heading is drawn once,
            // when the group changes.
            const showGroup =
              option.group && option.group !== choice.options[index - 1]?.group
            return (
              <li key={option.id}>
                {showGroup && (
                  <p className="bg-muted text-muted-foreground px-3 py-1 text-[11px] font-medium uppercase">
                    {option.group}
                  </p>
                )}
                <button
                  type="button"
                  className="hover:bg-accent w-full px-3 py-2 text-left text-xs disabled:opacity-60"
                  disabled={disabled}
                  onClick={onPick ? () => onPick(option.label) : undefined}
                >
                  <span className="block font-medium">{option.label}</span>
                  {option.description && (
                    <span className="text-muted-foreground block">{option.description}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {choice.footer && <p className="text-muted-foreground text-xs">{choice.footer}</p>}
    </div>
  )
}
