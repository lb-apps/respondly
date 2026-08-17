import { RemoteImage } from "@/components/remote-image"
import { WhatsAppFormattedText } from "@/components/chat/whatsapp-formatted-text"
import { Bubble, type MessageSide } from "@/components/chat/message-row"

/**
 * A photo sent in a conversation, with its caption under it.
 *
 * Shared by the inbox and the assistant preview — the two had a copy each, and
 * they had already drifted: the preview drew a plain outlined box while the
 * inbox drew a filled bubble, so the same photo looked like it came from
 * someone else depending on which screen you read it on. It takes the same
 * `side` the message does, and the colour follows from that.
 *
 * ## The photo keeps its shape
 *
 * These URLs come from a connected system at runtime, so nothing here knows how
 * wide or tall the file is. That leaves exactly one safe way to size it: give
 * it bounds and let the browser solve the other side from the file's own
 * proportions. Constraining *both* — a full-width box with a capped height —
 * is what cropped a room photo down to a letterbox strip of itself and made a
 * 3:2 picture read as 8:3.
 *
 * So the height is the only bound that normally bites, and the width follows
 * from it. A landscape photo comes out narrower than the bubble it would
 * otherwise have filled, which is also the answer to it sitting too wide.
 */

/** How tall a photo may stand. Width is whatever the photo's own shape makes it. */
const MAX_HEIGHT = "max-h-48"

export function ChatImageCard({
  imageUrl,
  caption,
  side,
}: {
  imageUrl: string
  caption?: string
  side: MessageSide
}) {
  return (
    // `Bubble` is already shrink-to-fit, so the frame ends where the photo
    // does rather than reserving the column's full measure around it.
    <Bubble side={side} className="overflow-hidden p-0">
      <RemoteImage
        src={imageUrl}
        alt={caption ?? ""}
        className={`block h-auto ${MAX_HEIGHT} w-auto max-w-full object-contain`}
      />
      {caption ? (
        // Colour is inherited, not named: this strip sits on the speaker's own
        // bubble, and a fixed muted grey disappears on the filled one.
        <div className="border-t border-current/15 px-3.5 py-2 text-xs opacity-80">
          <WhatsAppFormattedText text={caption} />
        </div>
      ) : null}
    </Bubble>
  )
}
