import type { ThreadRow } from "@/components/chat/thread-view"
import type { MessageAuthor } from "@/components/chat/chat-message-bubble"
import type { ChatAttachmentView } from "@/components/chat/chat-attachments"
import { mergeTextImages, richFromSentContent } from "@/components/chat/rich-content"
import type { ThreadMessage } from "@/lib/supabase/queries/inbox"

/**
 * Inbox messages, normalised for the shared `ThreadView`.
 *
 * The business answers here, so our own replies are the ones sent from this
 * surface — `end`, and the filled bubble — and the guest arrives on the left.
 * The preview is the mirror of it, and says so in its own adapter.
 */
export function inboxThreadRows(
  messages: ThreadMessage[],
  guest: { phone: string }
): ThreadRow[] {
  return messages.map((m): ThreadRow => {
    if (m.event) {
      return {
        kind: "event",
        id: m.id,
        createdAt: m.createdAt,
        event: m.event,
        sender: m.sender,
      }
    }

    // A `system` row whose payload no longer parses — an event kind from a
    // version that has since been removed. Its sentence is still true.
    if (m.role === "system") {
      return { kind: "note", id: m.id, createdAt: m.createdAt, text: m.body }
    }

    const isGuest = m.role === "guest"
    const isStaff = m.role === "staff"
    const author: MessageAuthor = isGuest
      ? { kind: "contact", avatarSeed: guest.phone }
      : isStaff
        ? { kind: "staff", name: m.sender?.name ?? null, avatarUrl: m.sender?.avatarUrl ?? null }
        : { kind: "assistant" }

    const attachments: ChatAttachmentView[] = m.attachments.map((a) => ({
      kind: a.kind as "image" | "document",
      filename: a.filename,
      mimeType: a.mimeType,
      signedUrl: a.signedUrl,
    }))

    // Only what the assistant sent carries rich content: a guest's message is
    // words and files, and a teammate types plain text into the composer.
    const richItems =
      isGuest || isStaff ? [] : mergeTextImages(richFromSentContent(m.richContent), m.body)

    return {
      kind: "message",
      id: m.id,
      createdAt: m.createdAt,
      side: isGuest ? "start" : "end",
      author,
      text: m.body,
      richItems,
      attachments,
      chipParts: isGuest || isStaff ? [] : (m.toolTrace ?? []),
    }
  })
}
