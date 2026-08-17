"use client"

import { memo } from "react"
import { Bot, Headset, UserRound } from "lucide-react"

import { formatAssistantMessageText } from "@/lib/assistant/format-text"
import { WhatsAppFormattedText } from "@/components/chat/whatsapp-formatted-text"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import { Bubble, MessageMeta, MessageRow, type MessageSide } from "@/components/chat/message-row"
import { formatClockTr } from "@/lib/format/datetime"
import { initials } from "@/lib/inbox/list-utils"
import { ChatAttachmentGrid, type ChatAttachmentView } from "./chat-attachments"
import { MessageChips } from "./message-chips"
import { RichContent, type RichItem } from "./rich-content"

/**
 * One message, drawn the same way on every surface.
 *
 * The inbox and the assistant preview each used to have their own copy of this,
 * and the copies drifted — different rich content, different colours, different
 * avatars for the same person. There is one now; what differs between the two
 * surfaces is passed in, not branched on inside.
 *
 * It does no parsing: the caller hands over `richItems` already read from
 * whichever source that surface has (see `richFromSentContent` /
 * `richFromModelParts`), so this file never has to know where a message was
 * stored.
 */

/**
 * Who is speaking. A union rather than a pile of optional strings, because each
 * of these draws a different avatar and signs the message differently, and no
 * two of them can be true at once.
 */
export type MessageAuthor =
  /** The person we are talking to — their generated avatar, no byline. */
  | { kind: "contact"; name?: string | null; avatarSeed?: string | null; avatarUrl?: string | null }
  /** The assistant. */
  | { kind: "assistant" }
  /** A teammate who took over. */
  | { kind: "staff"; name: string | null; avatarUrl: string | null }

function authorByline(author: MessageAuthor): string | null {
  switch (author.kind) {
    // The avatar and the side already say it is them.
    case "contact":
      return null
    case "assistant":
      return "Asistan"
    case "staff":
      return author.name?.trim() || "Ekip"
  }
}

function AuthorAvatar({ author }: { author: MessageAuthor }) {
  if (author.kind === "assistant") {
    return (
      <ContactAvatar variant="plain" size="sm" fallbackClassName="bg-muted text-muted-foreground">
        <Bot className="size-3.5" />
      </ContactAvatar>
    )
  }

  if (author.kind === "staff") {
    const name = author.name?.trim() || null
    return (
      <ContactAvatar
        variant="plain"
        size="sm"
        seed={name ?? undefined}
        imageUrl={author.avatarUrl}
        imageAlt={name ?? ""}
        fallbackClassName={name ? undefined : "bg-muted text-muted-foreground"}
      >
        {name ? initials(name, "") : <Headset className="size-3.5" />}
      </ContactAvatar>
    )
  }

  const seed = author.avatarSeed?.trim() || null
  const name = author.name?.trim() || null

  // Their own face, generated from a stable id — the same one the contact card
  // and the persona picker show.
  if (seed && !author.avatarUrl) {
    return <ContactAvatar variant="plain" size="sm" seed={seed} />
  }

  return (
    <ContactAvatar
      variant="plain"
      size="sm"
      seed={name ?? undefined}
      imageUrl={author.avatarUrl ?? null}
      imageAlt={name ?? ""}
      fallbackClassName={name ? undefined : "bg-muted text-muted-foreground"}
    >
      {name ? initials(name, "") : <UserRound className="size-3.5" />}
    </ContactAvatar>
  )
}

export interface ChatMessageBubbleProps {
  /** Which edge this was sent from. Colour follows it — see `message-row.tsx`. */
  side: MessageSide
  author: MessageAuthor
  text: string
  /** Already read from this surface's own storage. */
  richItems?: RichItem[]
  attachments?: ChatAttachmentView[]
  /** Which tools ran: `messages.tool_trace` in the inbox, the turn's parts live. */
  chipParts?: unknown[]
  /** Shown under the message when the surface knows it — a live turn does not. */
  createdAt?: string
  /** Anchors the scroll-to-message from search. */
  id?: string
  onSourceClick?: (id: string) => void
  onConflictSourceClick?: (sourceId: string, highlight: string) => void
  /** Given only where the controls answer — the preview. */
  onQuickReply?: (label: string) => void
  quickReplyDisabled?: boolean
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  side,
  author,
  text,
  richItems = [],
  attachments = [],
  chipParts = [],
  createdAt,
  id,
  onSourceClick,
  onConflictSourceClick,
  onQuickReply,
  quickReplyDisabled = false,
}: ChatMessageBubbleProps) {
  const fromAssistant = author.kind === "assistant"

  // Only the assistant's own words get the link-stripping pass: a photo it sent
  // is rendered as a photo, so the bare URL must come out of the sentence.
  const displayText = fromAssistant ? formatAssistantMessageText(text, richItems) : text.trim()
  const time = createdAt ? formatClockTr(createdAt) : null
  const byline = authorByline(author)

  return (
    <MessageRow
      id={id}
      side={side}
      avatar={<AuthorAvatar author={author} />}
      meta={
        byline || time ? (
          <MessageMeta label={byline} time={time} dateTime={createdAt} />
        ) : undefined
      }
    >
      {attachments.length > 0 && (
        <ChatAttachmentGrid attachments={attachments} className="max-w-full" />
      )}

      {displayText && (
        <Bubble side={side}>
          <WhatsAppFormattedText text={displayText} />
        </Bubble>
      )}

      <RichContent
        items={richItems}
        side={side}
        onQuickReply={onQuickReply}
        quickReplyDisabled={quickReplyDisabled}
      />

      {fromAssistant && (
        <MessageChips
          parts={chipParts}
          onSourceClick={onSourceClick}
          onConflictSourceClick={onConflictSourceClick}
        />
      )}
    </MessageRow>
  )
})
