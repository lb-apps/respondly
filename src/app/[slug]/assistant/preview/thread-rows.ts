import type { UIMessage } from "ai"

import type { ThreadRow } from "@/components/chat/thread-view"
import type { MessageAuthor } from "@/components/chat/chat-message-bubble"
import { extractFileParts, type ChatAttachmentView } from "@/components/chat/chat-attachments"
import { mergeTextImages, richFromModelParts } from "@/components/chat/rich-content"
import { parseThreadEvent } from "@/lib/inbox/thread-events"
import type { PreviewThreadMessage } from "@/lib/supabase/queries/preview"

/**
 * Preview messages, normalised for the shared `ThreadView`.
 *
 * The tester plays the customer here, so their own messages are the ones sent
 * from this surface — `end`, and the filled bubble. The assistant answers from
 * `start`, exactly as a guest does in the inbox.
 */

/**
 * Who the tester is playing.
 *
 * Deliberately not a `PreviewPersona`: a finished session knows only what its
 * own snapshot kept, and the card it started from may since have been deleted.
 */
export interface PreviewSpeaker {
  name: string | null
  /** Seeds the generated avatar — their phone, so the face never changes. */
  phone: string | null
}

function contactAuthor(speaker: PreviewSpeaker | null): MessageAuthor {
  return { kind: "contact", name: speaker?.name ?? null, avatarSeed: speaker?.phone ?? null }
}

function textFromParts(parts: unknown[]): string {
  return parts
    .filter(
      (p): p is Record<string, unknown> =>
        typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "text"
    )
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n\n")
}

/** A stored session, read back from the database. */
export function previewThreadRows(
  messages: PreviewThreadMessage[],
  speaker: PreviewSpeaker | null
): ThreadRow[] {
  return messages.map((m): ThreadRow => {
    const event = parseThreadEvent(m.metadata)
    if (event) {
      // Nobody on the team "sent" a preview event — the assistant did.
      return { kind: "event", id: m.id, createdAt: m.createdAt, event, sender: null }
    }
    if (m.role === "system") {
      return { kind: "note", id: m.id, createdAt: m.createdAt, text: m.body }
    }

    const isAssistant = m.role === "assistant"
    const parts = m.parts ?? []
    const attachments: ChatAttachmentView[] = m.attachments.map((a) => ({
      id: a.id,
      kind: a.kind as "image" | "document",
      filename: a.filename,
      mimeType: a.mimeType,
      signedUrl: a.signedUrl,
    }))

    return {
      kind: "message",
      id: m.id,
      createdAt: m.createdAt,
      side: isAssistant ? "start" : "end",
      author: isAssistant ? { kind: "assistant" } : contactAuthor(speaker),
      text: m.body,
      richItems: isAssistant ? mergeTextImages(richFromModelParts(parts), m.body) : [],
      attachments,
      chipParts: isAssistant ? parts : [],
    }
  })
}

/**
 * The conversation being typed right now.
 *
 * Live turns are held in React state rather than read back from the database, so
 * their timestamps come from the caller (`useMessageTimestamps`), which freezes
 * one per message id instead of re-reading the clock on every render.
 */
export function livePreviewThreadRows(
  messages: UIMessage[],
  speaker: PreviewSpeaker | null,
  timeOf: (id: string) => string
): ThreadRow[] {
  return messages.map((m): ThreadRow => {
    const parts = (m.parts ?? []) as unknown[]
    const isAssistant = m.role === "assistant"
    const text = textFromParts(parts)

    return {
      kind: "message",
      id: m.id,
      createdAt: timeOf(m.id),
      side: isAssistant ? "start" : "end",
      author: isAssistant ? { kind: "assistant" } : contactAuthor(speaker),
      text,
      richItems: isAssistant ? mergeTextImages(richFromModelParts(parts), text) : [],
      attachments: isAssistant ? [] : extractFileParts(parts),
      chipParts: isAssistant ? parts : [],
    }
  })
}

/** An event the turn just recorded, shown without waiting for a refetch. */
export function liveEventRow(args: {
  id: string
  createdAt: string
  metadata: unknown
}): ThreadRow | null {
  const event = parseThreadEvent(args.metadata)
  if (!event) return null
  return { kind: "event", id: args.id, createdAt: args.createdAt, event, sender: null }
}
