"use client"

import { useState } from "react"

import { Bot, ExternalLink, List, MapPin, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { formatAssistantMessageText, extractImageUrls } from "@/lib/assistant/format-text"
import { WhatsAppFormattedText } from "@/components/chat/whatsapp-formatted-text"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import { RemoteImage } from "@/components/remote-image"
import {
  Bubble,
  MessageMeta,
  MessageRow,
  type MessageSide,
  type MessageSpeaker,
} from "@/components/chat/message-row"
import { formatClockTr } from "@/lib/format/datetime"
import { initials } from "@/lib/inbox/list-utils"
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
import { cn } from "@/lib/utils"
import {
  ChatAttachmentGrid,
  type ChatAttachmentView,
  extractFileParts,
} from "./chat-attachments"
import { MessageChips } from "./message-chips"

/** Max images pulled out of connected-system results for one bubble. */
const MAX_TOOL_IMAGES = 4

/** Built-in tools — anything else in a turn came from a connected MCP server. */
const BUILT_IN_TOOLS = new Set([
  "search_knowledge",
  "ask_choice",
  "show_carousel",
  "request_location",
  "send_link_button",
  "flag_source_conflict",
  "get_contact_profile",
  "update_contact_profile",
])

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null
}

type RichItem =
  | { type: "image"; imageUrl: string; caption?: string }
  | ChoiceMessage
  | CarouselMessage
  | { type: "cta"; body: string; buttonLabel: string; url: string }
  | { type: "location_request"; body: string }

function extractRichContent(parts: unknown[]): RichItem[] {
  const rich: RichItem[] = []
  const seenUrls = new Set<string>()

  for (const part of parts) {
    const rec = asRecord(part)
    if (!rec) continue
    const type = typeof rec.type === "string" ? rec.type : ""
    let toolName = ""
    if (type === "dynamic-tool") {
      toolName = typeof rec.toolName === "string" ? rec.toolName : ""
    } else if (type.startsWith("tool-")) {
      toolName = type.slice("tool-".length)
    } else {
      continue
    }

    const result = asRecord(rec.output ?? rec.result)

    if (toolName === "search_knowledge" && result) {
      const passages = Array.isArray(result.passages) ? result.passages : []
      for (const p of passages) {
        const pr = asRecord(p)
        if (!pr) continue
        const url = typeof pr.imageUrl === "string" ? pr.imageUrl : null
        if (!url || seenUrls.has(url)) continue
        seenUrls.add(url)

        rich.push({
          type: "image",
          imageUrl: url,
        })
      }
    } else if (toolName === "ask_choice" && result) {
      const choice = toChoiceMessage(result)
      if (choice) rich.push(choice)
    } else if (toolName === "show_carousel" && result) {
      const carousel = toCarouselMessage(result)
      if (carousel) rich.push(carousel)
    } else if (toolName === "request_location" && result) {
      const body = typeof result.body === "string" ? result.body.trim() : ""
      if (body) rich.push({ type: "location_request", body })
    } else if (toolName === "send_link_button" && result) {
      const url = typeof result.url === "string" ? result.url : null
      const label = typeof result.label === "string" ? result.label.trim() : ""
      const body = typeof result.body === "string" ? result.body.trim() : ""
      if (url && label && body) {
        rich.push({ type: "cta", body, buttonLabel: label, url })
      }
    } else if (toolName && !BUILT_IN_TOOLS.has(toolName) && result) {
      // A tool from a connected MCP server. We don't know its payload shape, so
      // look for images generically and ignore everything else.
      const remaining = MAX_TOOL_IMAGES - seenUrls.size
      if (remaining > 0 && result.ok !== false) {
        for (const image of extractMcpImages(result, remaining)) {
          if (seenUrls.has(image.url)) continue
          seenUrls.add(image.url)
          rich.push({
            type: "image",
            imageUrl: image.url,

          })
        }
      }
    }
  }

  // Same rule as the WhatsApp sender: a picture that is already a carousel card
  // is not also a loose photo. Kept in step so the preview shows what sends.
  const onCards = new Set(
    rich.flatMap((item) =>
      item.type === "carousel" ? item.cards.map((card) => card.imageUrl) : []
    )
  )
  if (onCards.size === 0) return rich

  return rich.filter(
    (item) => item.type !== "image" || !onCards.has(item.imageUrl)
  )
}

/**
 * Render-time safety net: if the model pasted a raw image URL into its reply
 * text (instead of letting a media passage auto-render), surface it as an
 * image item so the bubble shows the photo and the bare link can be stripped.
 */
function mergeTextImages(rich: RichItem[], text: string): RichItem[] {
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

/**
 * Preview of an `ask_choice` bubble, rendered the way WhatsApp will deliver it:
 * up to three answers are tappable buttons, more sit behind a list sheet.
 * Staff see the real shape before a guest does.
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
        {choice.footer && (
          <p className="text-xs text-muted-foreground">{choice.footer}</p>
        )}
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
            const showGroup =
              option.group && option.group !== choice.options[index - 1]?.group
            return (
              <li key={option.id}>
                {showGroup && (
                  <p className="bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground uppercase">
                    {option.group}
                  </p>
                )}
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-60"
                  disabled={disabled}
                  onClick={onPick ? () => onPick(option.label) : undefined}
                >
                  <span className="block font-medium">{option.label}</span>
                  {option.description && (
                    <span className="block text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {choice.footer && (
        <p className="text-xs text-muted-foreground">{choice.footer}</p>
      )}
    </div>
  )
}

/**
 * Preview of a `show_carousel` bubble: the same swipeable strip WhatsApp draws,
 * one card per option. A card whose button carries no link is a quick reply, so
 * it behaves like one here too — tapping it answers as the guest.
 */
function CarouselPreview({
  carousel,
  disabled,
  onPick,
}: {
  carousel: CarouselMessage
  disabled: boolean
  onPick?: (label: string) => void
}) {
  return (
    <Carousel
      opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
      className="w-full"
    >
      <CarouselContent className="-ml-2">
        {carousel.cards.map((card) => (
          <CarouselItem key={card.id} className="basis-44 pl-2">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border">
              <RemoteImage
                src={card.imageUrl}
                className="h-24 w-full object-cover"
              />
              {card.body && (
                <div className="grow px-2.5 py-2 text-xs">
                  <WhatsAppFormattedText text={card.body} />
                </div>
              )}
              {card.buttons.map((button) =>
                button.url ? (
                  <a
                    key={button.label}
                    href={button.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-t px-2.5 py-2 text-center text-xs font-medium text-primary hover:bg-accent"
                  >
                    {button.label}
                  </a>
                ) : (
                  <button
                    key={button.label}
                    type="button"
                    className="border-t px-2.5 py-2 text-center text-xs font-medium text-primary hover:bg-accent disabled:opacity-60"
                    disabled={disabled}
                    onClick={
                      onPick
                        ? () =>
                            onPick(
                              `${cardName(card.body, button.label)} — ${button.label}`
                            )
                        : undefined
                    }
                  >
                    {button.label}
                  </button>
                )
              )}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}

export function ChatMessageBubble({
  role,
  text,
  parts = [],
  attachments,
  onSourceClick,
  onConflictSourceClick,
  onQuickReplyClick,
  quickReplyDisabled = false,
  align = "auto",
  createdAt,
  author,
}: {
  role: string
  text: string
  parts?: unknown[]
  attachments?: ChatAttachmentView[]
  onSourceClick?: (id: string) => void
  onConflictSourceClick?: (sourceId: string, highlight: string) => void
  /** Preview: send the tapped option label as the next user message. */
  onQuickReplyClick?: (label: string) => void
  quickReplyDisabled?: boolean
  align?: "auto" | "start" | "end"
  /** Shown under the message when the surface knows it — a live turn does not. */
  createdAt?: string
  /**
   * Whoever is on the guest's side of this conversation. In the preview that is
   * the person signed in and typing, so they see their own face rather than a
   * stand-in for a customer who does not exist.
   */
  author?: { name: string | null; avatarUrl: string | null } | null
}) {
  const isUser = role === "user" || role === "guest"
  const isGuest = role === "guest"
  const richItems = isUser
    ? []
    : mergeTextImages(extractRichContent(parts), text)
  const displayText = isUser
    ? text.trim()
    : formatAssistantMessageText(text, richItems)

  const resolvedAttachments =
    attachments ?? (isUser ? extractFileParts(parts) : [])

  const side: MessageSide =
    align === "auto" ? (isUser ? "end" : "start") : align === "end" ? "end" : "start"
  // Colour follows the voice, not the edge: the business is the filled bubble
  // on both surfaces, even though it sits on opposite sides of them.
  const speaker: MessageSpeaker = isUser ? "contact" : "business"
  const time = createdAt ? formatClockTr(createdAt) : null
  const authorName = author?.name?.trim() || null

  return (
    <MessageRow
      side={side}
      avatar={
        isUser ? (
          <ContactAvatar
            variant="plain"
            size="sm"
            seed={authorName ?? undefined}
            imageUrl={author?.avatarUrl ?? null}
            imageAlt={authorName ?? ""}
            fallbackClassName={authorName ? undefined : "bg-muted text-muted-foreground"}
          >
            {authorName ? initials(authorName, "") : <UserRound className="size-3.5" />}
          </ContactAvatar>
        ) : (
          <ContactAvatar
            variant="plain"
            size="sm"
            fallbackClassName="bg-muted text-muted-foreground"
          >
            <Bot className="size-3.5" />
          </ContactAvatar>
        )
      }
      meta={
        isUser && !time ? undefined : (
          <MessageMeta
            label={isUser ? null : "Asistan"}
            time={time}
            dateTime={createdAt}
          />
        )
      }
    >
      {resolvedAttachments.length > 0 && (
        <ChatAttachmentGrid attachments={resolvedAttachments} className="max-w-full" />
      )}
      {displayText && (
        <Bubble speaker={speaker} side={side}>
          <WhatsAppFormattedText text={displayText} />
        </Bubble>
      )}
      {richItems.map((item, i) => {
        if (item.type === "image") {
          return (
            <div key={i} className="max-w-full overflow-hidden rounded-2xl border">
              <RemoteImage
                src={item.imageUrl}
                alt={item.caption}
                className="max-h-48 w-full object-cover"
              />
              {item.caption && (
                <div className="bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  <WhatsAppFormattedText text={item.caption} />
                </div>
              )}
            </div>
          )
        }
        if (item.type === "choice") {
          return (
            <ChoicePreview
              key={i}
              choice={item}
              disabled={quickReplyDisabled || !onQuickReplyClick}
              onPick={onQuickReplyClick}
            />
          )
        }
        if (item.type === "carousel") {
          return (
            <div key={i} className="w-full min-w-0">
              <CarouselPreview
                carousel={item}
                disabled={quickReplyDisabled || !onQuickReplyClick}
                onPick={onQuickReplyClick}
              />
            </div>
          )
        }
        if (item.type === "location_request") {
          return (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="gap-1.5 rounded-full text-xs"
            >
              <MapPin className="size-3" /> Konum gönder
            </Button>
          )
        }
        if (item.type === "cta") {
          return (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 rounded-full text-xs">
                {item.buttonLabel} <ExternalLink className="size-3" />
              </Button>
            </a>
          )
        }
        return null
      })}
      {!isUser && (
        <MessageChips
          parts={parts}
          onSourceClick={onSourceClick}
          onConflictSourceClick={onConflictSourceClick}
        />
      )}
    </MessageRow>
  )
}
