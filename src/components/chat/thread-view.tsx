"use client"

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react"

import { Spinner } from "@/components/ui/spinner"
import { groupByDay } from "@/lib/chat/day-groups"
import { orderTurnEvents } from "@/lib/chat/thread-order"
import { pinScrollFromBottom, type ScrollPin } from "@/lib/inbox/pin-scroll"
import type { ThreadEvent } from "@/lib/inbox/thread-events"
import type { ThreadSender } from "@/lib/supabase/queries/inbox"
import {
  ChatMessageBubble,
  type ChatMessageBubbleProps,
} from "@/components/chat/chat-message-bubble"
import { StickyDayHeading } from "@/components/chat/sticky-day-heading"
import { ThreadEventDivider } from "@/components/chat/thread-event-divider"
import { ThreadMessagesSkeleton } from "@/components/chat/thread-messages-skeleton"
import {
  ThreadColumn,
  ThreadDayGroup,
  ThreadScroller,
  ThreadTypingIndicator,
} from "@/components/chat/thread-surface"
import type { MessageSide } from "@/components/chat/message-row"

/**
 * A conversation, from the scroller down to the last row.
 *
 * The inbox and the assistant preview are the same reading surface with
 * different plumbing behind them, and they used to prove it by drifting: the
 * preview had no day headings, no scroll-to-bottom and no event lines, because
 * all of that lived inside the inbox page. It lives here now, and each surface
 * hands over rows it has already normalised — this component never learns where
 * a message was stored.
 *
 * What stays optional is what genuinely only one surface has. Leave `onLoadOlder`
 * out and no sentinel and no observer are mounted at all, rather than mounted
 * and told to do nothing.
 */

/** One line of the thread. */
export type ThreadRow =
  | ({ kind: "message"; id: string; createdAt: string } & Omit<
      ChatMessageBubbleProps,
      "id" | "createdAt" | "onSourceClick" | "onConflictSourceClick" | "onQuickReply" | "quickReplyDisabled"
    >)
  /** Something that happened to the conversation, not something anyone said. */
  | {
      kind: "event"
      id: string
      createdAt: string
      event: ThreadEvent
      sender: ThreadSender | null
    }
  /** A system row whose payload we no longer recognise — say it plainly. */
  | { kind: "note"; id: string; createdAt: string; text: string }

interface ThreadViewProps {
  rows: ThreadRow[]
  /** Which edge the "yazıyor…" indicator speaks from, or null to hide it. */
  typingSide?: MessageSide | null
  /** The whole thread is still arriving — draw the placeholder instead. */
  loading?: boolean
  /** Shown in place of the thread when there is nothing in it yet. */
  emptyState?: ReactNode
  /**
   * Given only where there is more history to fetch. Receives the scroll
   * viewport, because holding the reader's place across the insert is the
   * caller's job — it is the one that knows when the request starts.
   */
  onLoadOlder?: (viewport: HTMLElement | null) => void
  loadingOlder?: boolean
  onSourceClick?: (id: string) => void
  onConflictSourceClick?: (sourceId: string, highlight: string) => void
  /** Given only where the reply controls answer — the preview. */
  onQuickReply?: (label: string) => void
  quickReplyDisabled?: boolean
}

export function ThreadView({
  rows,
  typingSide = null,
  loading = false,
  emptyState,
  onLoadOlder,
  loadingOlder = false,
  onSourceClick,
  onConflictSourceClick,
  onQuickReply,
  quickReplyDisabled,
}: ThreadViewProps) {
  // Ordered before grouping: an event the assistant caused belongs after the
  // reply it came with, which its own timestamp does not say. See
  // `@/lib/chat/thread-order`.
  const dayGroups = useMemo(
    () => groupByDay(orderTurnEvents(rows), (row) => row.createdAt),
    [rows]
  )

  if (loading) {
    return (
      <ThreadScroller>
        <ThreadColumn aria-busy="true">
          <ThreadDayGroup>
            <ThreadMessagesSkeleton />
          </ThreadDayGroup>
        </ThreadColumn>
      </ThreadScroller>
    )
  }

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <ThreadScroller>
      <ThreadColumn>
        <ThreadTop onLoadOlder={onLoadOlder} loadingOlder={loadingOlder} />

        {dayGroups.map((group) => (
          <ThreadDayGroup key={group.key}>
            <StickyDayHeading label={group.label} />
            {group.items.map((row) => {
              if (row.kind === "event") {
                return (
                  <ThreadEventDivider
                    key={row.id}
                    id={row.id}
                    event={row.event}
                    // The whole sender, not just the name: a teammate with no
                    // name on file must not read as the assistant.
                    sender={row.sender}
                    createdAt={row.createdAt}
                  />
                )
              }

              if (row.kind === "note") {
                return (
                  <div
                    key={row.id}
                    id={`msg-${row.id}`}
                    className="text-muted-foreground py-1 text-center text-xs"
                  >
                    {row.text}
                  </div>
                )
              }

              const { kind: _kind, id, createdAt, ...bubble } = row
              void _kind
              return (
                <ChatMessageBubble
                  key={id}
                  id={`msg-${id}`}
                  createdAt={createdAt}
                  onSourceClick={onSourceClick}
                  onConflictSourceClick={onConflictSourceClick}
                  onQuickReply={onQuickReply}
                  quickReplyDisabled={quickReplyDisabled}
                  {...bubble}
                />
              )
            })}
          </ThreadDayGroup>
        ))}

        {typingSide ? <ThreadTypingIndicator side={typingSide} /> : null}

        <ThreadBottom latestRowId={rows[rows.length - 1]?.id} />
      </ThreadColumn>
    </ThreadScroller>
  )
}

/**
 * Where the thread continues upwards.
 *
 * The sentinel sits above the spinner so it enters the viewport first and the
 * page is already on its way by the time anything is shown. Rendered only when
 * there is history to fetch — a surface that loads everything at once should not
 * pay for an observer.
 */
function ThreadTop({
  onLoadOlder,
  loadingOlder,
}: {
  onLoadOlder?: (viewport: HTMLElement | null) => void
  loadingOlder: boolean
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onLoadOlder) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const root = sentinel.closest<HTMLElement>("[data-slot=scroll-area-viewport]")
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadOlder(root)
      },
      { root, rootMargin: "600px 0px 0px 0px", threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // Callers pass a `useCallback`, so this rebuilds only when what it should do
    // actually changes — no ref smuggling a fresh closure past the dependency.
  }, [onLoadOlder])

  if (!onLoadOlder) return null

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full shrink-0" />
      {loadingOlder ? (
        <div
          className="flex justify-center pb-4"
          role="status"
          aria-label="Eski mesajlar yükleniyor"
        >
          <Spinner className="text-muted-foreground" />
        </div>
      ) : null}
    </>
  )
}

/**
 * Land on the newest message and hold there while it settles.
 *
 * Keyed on the last row's id rather than the row count: an edit that replaces a
 * message must not scroll, and a message arriving must. `pinScrollFromBottom`
 * then re-applies the position as images decode, and lets go the moment the
 * reader scrolls themselves.
 */
function ThreadBottom({ latestRowId }: { latestRowId?: string }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<ScrollPin | null>(null)

  useEffect(() => {
    if (pinRef.current?.active) return
    const viewport = bottomRef.current?.closest<HTMLElement>(
      "[data-slot=scroll-area-viewport]"
    )
    if (!viewport) return

    viewport.scrollTo({ top: viewport.scrollHeight })
    const settle = pinScrollFromBottom(viewport, {
      toBottom: true,
      idleMs: null,
      maxMs: null,
    })
    pinRef.current = settle
    return () => {
      settle.release()
      pinRef.current = null
    }
  }, [latestRowId])

  return <div ref={bottomRef} />
}

/**
 * Scroll a message into view and flash it, the way the inbox search does.
 * Deliberately DOM-driven: nothing about a jump belongs in render state.
 */
export function useJumpToMessage() {
  return useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ block: "center", behavior: "smooth" })
    el.classList.add("ring-2", "ring-ring", "ring-offset-2", "rounded-2xl")
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-ring", "ring-offset-2", "rounded-2xl")
    }, 1600)
  }, [])
}
