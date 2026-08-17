"use client"

import { Bot } from "lucide-react"

import { cn } from "@/lib/utils"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"

/**
 * The page a conversation is read on, shared by the inbox and the assistant
 * preview.
 *
 * Both show the same thing — a conversation with this business — and differ
 * only in where it comes from: real messages on one side, a sandbox on the
 * other. When each owned its own padding, width and rhythm, the preview stopped
 * being a preview: it answered questions about a layout nobody would ever see.
 *
 * What lives here is the surface, not the messages. The bubbles stay apart on
 * purpose — the inbox reads `ThreadMessage` rows and the preview reads model
 * `parts`, and the two are mirrored (the guest is across the table in the inbox,
 * and is the person typing in the preview).
 */

/**
 * The surface a thread is read on — its background, the space it takes in the
 * pane, and its gutter. Named so a placeholder can stand on the same ground
 * without inheriting the scroll machinery below, and so the two cannot drift
 * apart the next time the gutter changes.
 */
export const THREAD_SURFACE = "bg-sidebar min-h-0 flex-1 px-6"

/**
 * The scroller.
 *
 * `overflow-anchor: none` hands scroll compensation to the caller: when older
 * messages are prepended, the browser's own anchoring would correct on top of
 * the pin and move the view twice as far (see `@/lib/inbox/pin-scroll`). The
 * viewport override next to it makes Radix's inner wrapper a block box, so a
 * sticky day heading has a containing block to stick to.
 */
export function ThreadScroller({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <ScrollArea
      className={cn(
        THREAD_SURFACE,
        "[&_[data-slot=scroll-area-viewport]]:[overflow-anchor:none]",
        "[&_[data-slot=scroll-area-viewport]>div]:!block",
        className
      )}
    >
      {children}
    </ScrollArea>
  )
}

/**
 * The column the conversation is read in, one step narrower than the pane
 * around it. At full width the two sides of a thread drift so far apart that
 * reading becomes a tennis match; 48rem keeps them in one field of view while
 * the bubbles keep their own measure. The composer below matches, so the column
 * reads as one shape.
 */
export function ThreadColumn({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto flex max-w-3xl flex-col py-6", className)} {...props}>
      {children}
    </div>
  )
}

/** One day's messages, at the thread's own spacing. */
export function ThreadDayGroup({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-5 pb-5", className)}>{children}</section>
  )
}

/**
 * Where the reply will land, so the eye is already in the right place when it
 * arrives. `aria-live` announces it once; the spinner is decoration and the
 * words carry the meaning.
 *
 * `side` is which edge the assistant speaks from — the right in the inbox,
 * where the business is answering, and the left in the preview, where the
 * tester is playing the guest.
 */
export function ThreadTypingIndicator({
  side = "end",
  className,
}: {
  side?: "start" | "end"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 pb-5",
        side === "end" ? "justify-end" : "flex-row-reverse justify-end",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="text-muted-foreground flex items-center gap-2 text-xs">
        <Spinner className="size-3.5" aria-hidden />
        yazıyor…
      </span>
      <ContactAvatar
        variant="plain"
        size="sm"
        fallbackClassName="bg-muted text-muted-foreground"
      >
        <Bot className="size-3.5" />
      </ContactAvatar>
    </div>
  )
}
