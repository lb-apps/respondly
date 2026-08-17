import { cn } from "@/lib/utils"

/**
 * One line of a conversation: avatar, what was said, and who said it when.
 *
 * Shared by the inbox and the assistant preview so a message looks the same
 * wherever it is read. The two surfaces are mirror images of each other — in the
 * inbox you are the business answering a guest, in the preview you are the guest
 * testing the assistant — and the reader is always the one typing.
 *
 * **Colour follows the edge:** whatever is sent from this surface is the filled
 * bubble on the right, whatever arrives is the outlined one on the left. That is
 * the same rule every chat app has trained people on, and it means `side` alone
 * decides the colour — there is no second input to get out of step with it.
 */

export type MessageSide = "start" | "end"

/**
 * The bubble, with its corner cut on the side it is spoken from — the tail that
 * points back at the speaker's avatar.
 */
export function Bubble({
  side,
  className,
  children,
}: {
  side: MessageSide
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "w-fit max-w-full min-w-0 rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words [overflow-wrap:anywhere]",
        // The tail corner is tucked in, not squared off: a hard 90° reads as a
        // clipping mistake at this size, while a small radius still points.
        side === "start" ? "rounded-bl-sm" : "rounded-br-sm",
        // Colour separates the two sides; it does not rank them. Neither half of
        // a conversation is a call to action, so neither wears `--primary`.
        side === "end"
          ? "bg-bubble-sent text-bubble-sent-foreground"
          : "border-border bg-card text-card-foreground border",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * The row the bubble sits in.
 *
 * A two-column grid rather than a flex row: the avatar sits on the baseline of
 * the last bubble while the byline goes under the message and not under the
 * avatar, and both have to hold when a message grows into several blocks — a
 * photo, a carousel, chips.
 *
 * The measure lives on the message column (~70 characters), so a row can be as
 * wide as the thread while a line of text never is.
 */
export function MessageRow({
  side,
  id,
  avatar,
  meta,
  className,
  children,
}: {
  side: MessageSide
  /** Anchors the scroll-to-message from search. */
  id?: string
  avatar?: React.ReactNode
  /** The byline under the message: who, and when. */
  meta?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const start = side === "start"

  return (
    <div
      id={id}
      className={cn(
        "grid gap-x-2.5 gap-y-1 transition-shadow",
        start
          ? "grid-cols-[auto_1fr] self-start"
          : "grid-cols-[1fr_auto] justify-items-end self-end",
        className
      )}
    >
      {avatar ? (
        <div
          className={cn(
            "row-start-1 self-end",
            start ? "col-start-1" : "col-start-2"
          )}
        >
          {avatar}
        </div>
      ) : null}
      <div
        className={cn(
          "row-start-1 flex min-w-0 max-w-11/12 flex-col gap-1.5 sm:max-w-lg",
          start ? "col-start-2" : "col-start-1 items-end"
        )}
      >
        {children}
      </div>
      {meta ? (
        <div
          className={cn(
            "text-muted-foreground row-start-2 flex items-center gap-1.5 text-xs",
            start ? "col-start-2" : "col-start-1"
          )}
        >
          {meta}
        </div>
      ) : null}
    </div>
  )
}

/** Name · time, as one line. The dot is decoration; the words carry it. */
export function MessageMeta({
  label,
  time,
  dateTime,
}: {
  label?: string | null
  time?: string | null
  dateTime?: string
}) {
  return (
    <>
      {label ? <span className="truncate">{label}</span> : null}
      {label && time ? (
        <span aria-hidden className="bg-current/60 size-1 shrink-0 rounded-full" />
      ) : null}
      {time ? (
        <time dateTime={dateTime} className="tabular-nums">
          {time}
        </time>
      ) : null}
    </>
  )
}
