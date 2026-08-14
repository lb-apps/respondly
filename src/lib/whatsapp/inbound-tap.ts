/**
 * Reading a tap out of an inbound WhatsApp message.
 *
 * One gesture, three payload shapes, and Meta picks by where the button lived:
 *
 *  - a reply button → `interactive.button_reply`
 *  - a list row     → `interactive.list_reply`
 *  - a quick reply on a carousel card or a template → a `button` message, where
 *    our id is called `payload` and the label `text`
 *
 * Handling only the first two is what made every carousel tap arrive as the
 * bare word "Detaylar", leaving the assistant to ask which card it meant. Pure
 * and separate from the route so all three shapes stay under test.
 */

import { decodeCardTap } from "@/lib/whatsapp/carousel-message"

/** Only the fields a tap is read from. */
export interface InboundTapSource {
  type?: string
  button?: { text?: string; payload?: string }
  interactive?: {
    type?: string
    button_reply?: { id?: string; title?: string }
    list_reply?: { id?: string; title?: string }
  }
}

export interface TapReply {
  /** Ours when we minted it; Meta's otherwise. */
  id?: string
  /** What the button said on screen. */
  title?: string
}

/** The button or row this message tapped, or null if it tapped none. */
export function interactiveReply(msg: InboundTapSource): TapReply | null {
  if (msg.type === "interactive") {
    return msg.interactive?.button_reply ?? msg.interactive?.list_reply ?? null
  }
  if (msg.type === "button" && msg.button) {
    return { id: msg.button.payload, title: msg.button.text }
  }
  return null
}

/**
 * What the tap says, when the id alone is enough to say it.
 *
 * Null means the id told us nothing — the caller then looks the tap up against
 * the message it answered, and falls back to the label if that fails too.
 */
export function tapText(reply: TapReply): string | null {
  const tap = decodeCardTap(reply.id)
  if (tap) return `${tap.name} — ${tap.label}`
  return null
}
