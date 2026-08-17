import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Bubble, MessageRow, type MessageSide } from "@/components/chat/message-row"

/**
 * A conversation with the words not yet in it.
 *
 * Built from the same `MessageRow` and `Bubble` the loaded thread uses, so the
 * row grid, the avatar column, the measure, the tail corner and the byline are
 * identical by construction rather than by imitation — and stay identical when
 * any of them changes. See the skeleton rule in CLAUDE.md.
 *
 * Each bubble is sized by empty lines of its own text (`h-[1lh]` against the
 * bubble's own `text-sm leading-relaxed`), so a two-line placeholder occupies
 * exactly what two lines of message will and nothing reflows when the real
 * conversation lands on top of it.
 *
 * Shared by the inbox and the assistant preview, and identical on both: whoever
 * is typing on this surface sends from the right, whoever answers arrives on the
 * left. It used to take a `businessSide` because colour followed the voice
 * rather than the edge, and the two surfaces disagreed about which edge the
 * filled bubble sat on. They no longer do.
 */

/**
 * The measure of a full line: the message column caps at `max-w-lg` (32rem) and
 * the bubble spends `px-3.5` either side, so a line that reaches the edge is
 * 32 − 1.75.
 */
const FULL_LINE = "30.25rem"

/** `sent` is a message from this surface — the long ones, on the right. */
const ROWS: ReadonlyArray<{ sent: boolean; lines: readonly string[] }> = [
  { sent: true, lines: [FULL_LINE, FULL_LINE, "11rem"] },
  { sent: false, lines: ["10rem"] },
  { sent: true, lines: [FULL_LINE, "17rem"] },
  { sent: false, lines: ["15rem"] },
  { sent: true, lines: [FULL_LINE, "24rem", "8rem"] },
]

export function ThreadMessagesSkeleton({
  withDayHeading = true,
}: {
  /** The day divider above the first message. */
  withDayHeading?: boolean
}) {
  return (
    <>
      {withDayHeading ? (
        // The day divider in its unstuck state: rule, chip, rule.
        <div className="flex items-center gap-3">
          <div className="bg-border/70 h-px min-w-0 flex-1" aria-hidden />
          <Skeleton className="h-[calc(1lh+0.5rem)] w-32 shrink-0 rounded-full text-xs" />
          <div className="bg-border/70 h-px min-w-0 flex-1" aria-hidden />
        </div>
      ) : null}

      {ROWS.map((row, i) => {
        const side: MessageSide = row.sent ? "end" : "start"
        return (
          <MessageRow
            key={i}
            side={side}
            avatar={<Skeleton className="size-7 rounded-full" />}
            meta={
              <Skeleton
                className={cn(
                  "h-[1lh] rounded-md",
                  // "Asistan · 19:24" against a bare "19:24".
                  row.sent ? "w-24" : "w-10"
                )}
              />
            }
          >
            <Bubble
              side={side}
              className="bg-muted animate-pulse border-transparent"
            >
              {row.lines.map((width, line) => (
                // `max-w-full` so a narrow pane clamps the line to the column
                // instead of overflowing the bubble.
                <span
                  key={line}
                  className="block h-[1lh] max-w-full"
                  style={{ width }}
                />
              ))}
            </Bubble>
          </MessageRow>
        )
      })}
    </>
  )
}
