"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Bot,
  Check,
  CornerDownLeft,
  ExternalLink,
  Headset,
  Inbox as InboxIcon,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  SendHorizontal,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { getSourceDetailAction } from "@/app/[slug]/knowledge/actions"
import { SourceDetailSheet } from "@/app/[slug]/knowledge/source-detail-sheet"
import type { SourceDetail } from "@/lib/supabase/queries/knowledge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useInboxConversationList } from "@/hooks/use-inbox-conversation-list"
import type {
  ConversationListItem,
  ConversationThread,
  ThreadCursor,
  ThreadMessage,
} from "@/lib/supabase/queries/inbox"
import type { ContactDetail } from "@/lib/supabase/queries/contacts"
import { formatPhoneDisplay, toWhatsAppHref } from "@/lib/phone"
// The one clock in the app: the preview renders its bylines with this too, so
// a message reads the same hour on both surfaces.
import { formatClockTr } from "@/lib/format/datetime"
import {
  channelLabel,
  formatWaitDuration,
  isAssistantTyping,
  mergeThreadMessages,
  TURN_LOCK_TTL_MS,
} from "@/lib/inbox/list-utils"
import { ContactDetailPanel } from "./contact-detail-panel"
import { ConversationList } from "./conversation-list"
import { inboxThreadRows } from "./thread-rows"
import { ThreadView } from "@/components/chat/thread-view"
import {
  ThreadColumn,
  ThreadDayGroup,
  THREAD_SURFACE,
} from "@/components/chat/thread-surface"
import { pinScrollFromBottom, type ScrollPin } from "@/lib/inbox/pin-scroll"
import { ThreadMessagesSkeleton } from "@/components/chat/thread-messages-skeleton"
import {
  closeConversation,
  loadOlderMessages,
  markConversationRead,
  returnToBot,
  sendStaffReply,
  takeoverConversation,
  togglePin,
  type ActionResult,
} from "./actions"

interface Props {
  slug: string
  organizationId: string
  conversations: ConversationListItem[]
  activeId: string | null
  thread: ConversationThread | null
  contactDetail: ContactDetail | null
}

export function InboxClient({
  slug,
  organizationId,
  conversations,
  activeId,
  thread,
  contactDetail,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  /**
   * The thread a click has asked for, paired with the thread that was open when
   * it was made. See `pendingSelection` below for why the pair.
   */
  const [pendingId, setPendingId] = useState<{
    id: string
    from: string | null
  } | null>(null)
  const [draft, setDraft] = useState("")
  // The contact card is an overlay at every width, never a column.
  //
  // As a column it took its space from the thread — the conversation reflowed
  // and lines rewrapped just because someone glanced at a phone number. Over
  // the top, the thread stays exactly where it was and the card costs nothing
  // to open or dismiss. Closed to begin with: opening a conversation is a
  // request to read it, not to inspect the person.
  const [detailOpen, setDetailOpen] = useState(false)
  const [readOverrides, setReadOverrides] = useState<Record<string, number>>({})

  const onSync = useCallback(() => router.refresh(), [router])

  const liveConversations = useInboxConversationList({
    organizationId,
    activeId,
    serverConversations: conversations,
    onRefresh: onSync,
  })

  const listConversations = useMemo(
    () =>
      liveConversations.map((c) => ({
        ...c,
        unreadCount: readOverrides[c.id] ?? c.unreadCount,
      })),
    [liveConversations, readOverrides]
  )

  useEffect(() => {
    setReadOverrides((prev) => {
      const next = { ...prev }
      let changed = false
      for (const id of Object.keys(next)) {
        const server = conversations.find((c) => c.id === id)
        if (!server || server.unreadCount === next[id]) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [conversations])

  useEffect(() => {
    if (!activeId) return
    const active = conversations.find((c) => c.id === activeId)
    if (!active || active.unreadCount === 0) return
    setReadOverrides((prev) => ({ ...prev, [activeId]: 0 }))
    void markConversationRead({ conversationId: activeId, slug })
  }, [activeId, slug, conversations])

  // Whether the click is still outstanding is derived, not synced: an Effect
  // clearing it on `activeId` would re-render the whole inbox a second time on
  // arrival, right when the new thread is being painted.
  //
  // `from` is what makes it self-expiring. The selection is only outstanding
  // while the server is still showing the thread it was made from — once
  // `activeId` is the requested thread the click has landed, and if it moves
  // anywhere else (Back/Forward, a realtime refresh) the click is void.
  const pendingSelection =
    pendingId && pendingId.id !== activeId && pendingId.from === activeId
      ? pendingId.id
      : null

  // What the list draws as selected. Ahead of the server while a thread is
  // opening, identical to it the rest of the time.
  const selectedId = pendingSelection ?? activeId
  // The open thread is the previous one until the payload lands. Showing it
  // under a freshly-selected row would attribute one guest's messages to
  // another, which is worse than showing nothing.
  const threadStale = pendingSelection != null

  // The breadcrumb names the thread being opened, not the one being left. The
  // list row already holds the name, so this costs no round trip.
  const headerConversation = pendingSelection
    ? (listConversations.find((c) => c.id === pendingSelection) ?? null)
    : (thread?.conversation ?? null)

  function togglePanel() {
    setDetailOpen((open) => !open)
  }

  function select(id: string) {
    if (id === activeId) return
    setReadOverrides((prev) => ({ ...prev, [id]: 0 }))

    // The row highlights on the click, not on the server's answer. `activeId`
    // arrives with the RSC payload a round trip later, and until this was held
    // locally the whole inbox sat unchanged after a click — the thread that was
    // already open stayed lit, and nothing said the new one was on its way.
    setPendingId({ id, from: activeId })

    // Marking read is bookkeeping the reader never waits for. Awaited inside a
    // transition it held the pending state open for the length of its own round
    // trip, on top of the navigation's.
    void markConversationRead({ conversationId: id, slug })

    router.push(`/${slug}/inbox?c=${id}`)
  }

  function handleTogglePin(id: string, pinned: boolean) {
    startTransition(async () => {
      const res = await togglePin({ conversationId: id, slug, pinned })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      router.refresh()
    })
  }

  function handleResult(res: ActionResult, successMsg: string) {
    if (!res.ok) {
      toast.error("Hata", { description: res.error })
      return
    }
    if (successMsg) toast.success(successMsg)
  }

  function send() {
    const body = draft.trim()
    if (!body || !activeId) return
    startTransition(async () => {
      const res = await sendStaffReply({ conversationId: activeId, slug, body })
      if (res.ok) setDraft("")
      handleResult(res, "")
      router.refresh()
    })
  }

  function takeover() {
    if (!activeId) return
    startTransition(async () => {
      handleResult(
        await takeoverConversation({ conversationId: activeId, slug }),
        "Konuşmayı devraldın"
      )
      router.refresh()
    })
  }

  function backToBot() {
    if (!activeId) return
    startTransition(async () => {
      handleResult(
        await returnToBot({ conversationId: activeId, slug }),
        "Bota geri verildi"
      )
      router.refresh()
    })
  }

  function close() {
    if (!activeId) return
    startTransition(async () => {
      handleResult(
        await closeConversation({ conversationId: activeId, slug }),
        "Konuşma kapatıldı"
      )
      router.refresh()
    })
  }

  return (
    <TooltipProvider>
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {/* Not a link any more: the inbox always has a conversation open,
                  so there is no emptier version of this page to go back to. */}
              <BreadcrumbPage>Gelen Kutusu</BreadcrumbPage>
            </BreadcrumbItem>
            {headerConversation ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {headerConversation.guestName ||
                      formatPhoneDisplay(headerConversation.guestPhone)}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex min-h-0 flex-1">
      <ConversationList
        conversations={listConversations}
        activeId={selectedId}
        onSelect={select}
        onTogglePin={handleTogglePin}
      />

      {/* Thread */}
      {threadStale ? (
        <ThreadSkeleton />
      ) : thread ? (
        <ConversationPane
          key={thread.conversation.id}
          thread={thread}
          turnLockedAt={
            listConversations.find((c) => c.id === thread.conversation.id)
              ?.turnLockedAt ?? thread.conversation.turnLockedAt
          }
          slug={slug}
          draft={draft}
          setDraft={setDraft}
          pending={pending}
          onSend={send}
          onTakeover={takeover}
          onBackToBot={backToBot}
          onClose={close}
          onTogglePanel={togglePanel}
          panelOpen={detailOpen}
          onTogglePin={handleTogglePin}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>Bir konuşma seç</EmptyTitle>
              <EmptyDescription>
                Soldan bir misafir konuşması seçerek mesajları gör ve yanıtla.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}

      {/* Contact card — an overlay from the right, at every width.
          Keyed on contactId + updatedAt (not just contactId): a profile write
          by staff or the assistant while the card is already mounted for the
          same contact must reset the draft state, and `key` is how React does
          that without an Effect syncing props into state on every render. */}
      {thread && contactDetail && (
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent
            side="right"
            className="w-88 max-w-full p-0 sm:max-w-sm"
            // Opening the card is a request to *read* it. Radix focuses the
            // first field by default, which lands the caret in "Ad" with the
            // name selected — one keystroke from overwriting it. The panel
            // still takes focus itself, so Esc and tabbing work.
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetTitle className="sr-only">Kişi bilgileri</SheetTitle>
            {/* No `onClose`: the sheet draws its own close button, and two of
                them in the same corner is one too many. */}
            <ContactDetailPanel
              key={`${contactDetail.contactId ?? thread.conversation.id}-${contactDetail.updatedAt ?? "new"}`}
              detail={contactDetail}
              slug={slug}
            />
          </SheetContent>
        </Sheet>
      )}
      </div>
    </div>
    </TooltipProvider>
  )
}

/**
 * The shape of the thread being opened, drawn from the same parts as the thread
 * itself.
 *
 * Built out of `MessageRow` and `Bubble` rather than a hand-rolled stack of
 * grey boxes: the row grid, the avatar column, the measure, the tail corner and
 * the byline are then identical by construction, and stay identical when any of
 * them is changed. Nothing here is allowed to guess a size.
 *
 * Each bubble is sized by empty lines of its own text — `h-[1lh]` against the
 * bubble's own `text-sm leading-relaxed` — so a two-line placeholder occupies
 * exactly what two lines of message will. The pane does not reflow when the
 * real conversation lands on top of it.
 */

function ThreadSkeleton() {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      // Busy, not a live region: the messages announce themselves once the
      // thread renders, and a placeholder has nothing to read out.
      aria-busy="true"
      aria-label="Konuşma yükleniyor"
    >
      <header className="flex h-[68px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-col gap-1">
          {/* `1lh` resolves against the type scale set on the element itself,
              so these are the name and subtitle lines to the pixel. */}
          <Skeleton className="h-[1lh] w-40 rounded-md text-sm leading-tight" />
          <Skeleton className="h-[1lh] w-28 rounded-md text-xs" />
        </div>
      </header>
      <Separator />

      {/* The thread's surface without its scroller. A thread is read at its
          newest end, so the placeholder has to sit on the bottom edge the way a
          conversation scrolled to its latest message does — starting at the top
          and trailing off into empty space is a shape no thread ever has. The
          scroll machinery is what makes that awkward (Radix owns the box in
          between), and a placeholder has nothing to scroll, so it stands on the
          same surface and skips the rest. */}
      <div className={cn(THREAD_SURFACE, "flex flex-col justify-end overflow-hidden")}>
        {/* `w-full` because this parent is a flex column and `ThreadColumn`
            carries `mx-auto`: auto margins on the cross axis cancel `stretch`,
            which shrank the column to its content and pulled the whole
            conversation 50px in from both gutters. Under the real scroller the
            column's parent is a block, where `mx-auto` simply centres a
            full-width box. */}
        <ThreadColumn className="w-full">
          <ThreadDayGroup>
            <ThreadMessagesSkeleton />
          </ThreadDayGroup>
        </ThreadColumn>
      </div>

      <Separator />
      <div className="px-6 py-4">
        <InputGroup className="mx-auto h-auto max-w-3xl items-end">
          <InputGroupTextarea
            placeholder=""
            disabled
            className="min-h-10"
            rows={1}
            aria-hidden
            tabIndex={-1}
          />
          {/* The send button is what the composer takes its height from — left
              out, the whole bar sat 4px short of the real one. */}
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-sm" disabled aria-hidden tabIndex={-1}>
              <SendHorizontal className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground mx-auto mt-2 flex max-w-3xl items-center gap-1 text-xs">
          <CornerDownLeft className="size-3" /> Göndermek için ⌘/Ctrl + Enter.
          Yanıt yazınca konuşma ekibe geçer.
        </p>
      </div>
    </section>
  )
}

interface PaneProps {
  thread: ConversationThread
  /** When the running assistant turn took its lock, or null if none is. */
  turnLockedAt: string | null
  /** Needed by the knowledge source sheet the chips open. */
  slug: string
  draft: string
  setDraft: (v: string) => void
  pending: boolean
  onSend: () => void
  onTakeover: () => void
  onBackToBot: () => void
  onClose: () => void
  onTogglePanel: () => void
  /** Drives the toggle's icon and label, so it says what it will do. */
  panelOpen: boolean
  onTogglePin: (id: string, pinned: boolean) => void
}

function ConversationPane({
  thread,
  turnLockedAt,
  slug,
  draft,
  setDraft,
  pending,
  onSend,
  onTakeover,
  onBackToBot,
  onClose,
  onTogglePanel,
  panelOpen,
  onTogglePin,
}: PaneProps) {
  const { conversation } = thread

  // Paging state. The component is keyed by conversation id, so switching
  // threads mounts a fresh one — no effect has to clear any of this.
  const [loadedPages, setLoadedPages] = useState<ThreadMessage[]>(thread.messages)
  const [cursor, setCursor] = useState<ThreadCursor | null>(thread.nextCursor)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // The server keeps re-sending the newest page (every realtime event refreshes
  // the route). Fold it in rather than replace: by then the reader may be well
  // above it. Adjusting state while rendering, not in an effect — React applies
  // it before the browser paints, so nothing renders the stale list.
  const [serverMessages, setServerMessages] = useState(thread.messages)
  if (serverMessages !== thread.messages) {
    setServerMessages(thread.messages)
    setLoadedPages((prev) => mergeThreadMessages(prev, thread.messages))
  }

  const messages = loadedPages
  /**
   * Holds the reader's place while an older page is being added above them.
   * Live for the whole insertion — the spinner, the messages, then the photos
   * decoding — rather than for one commit; see `@/lib/inbox/pin-scroll`.
   */
  const pinRef = useRef<ScrollPin | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Opened from the chips under an assistant message. Same pair of handlers the
  // preview uses (`assistant/preview/preview-client.tsx`), so a source opens the
  // same way whether staff found it in a test chat or a real one.
  const [sheetSource, setSheetSource] = useState<SourceDetail | null>(null)
  const [highlightQuery, setHighlightQuery] = useState("")

  async function handleSourceClick(sourceId: string) {
    const detail = await getSourceDetailAction(sourceId)
    if (detail) {
      setHighlightQuery("")
      setSheetSource(detail)
    }
  }

  async function handleConflictSourceClick(sourceId: string, highlight: string) {
    const detail = await getSourceDetailAction(sourceId)
    if (detail) {
      setHighlightQuery(highlight.trim())
      setSheetSource(detail)
    }
  }

  const guestPhone = conversation.guestPhone
  const rows = useMemo(
    () => inboxThreadRows(messages, { phone: guestPhone }),
    [messages, guestPhone]
  )

  const conversationId = conversation.id

  const loadOlder = useCallback(async (viewport: HTMLElement | null) => {
    if (!cursor || loadingOlder) return
    // Pinned from the moment the page is asked for, because the first thing to
    // move the reader is the spinner appearing above them — before any message
    // has arrived to render.
    pinRef.current?.release()
    pinRef.current = viewport
      ? pinScrollFromBottom(viewport, {
          onRelease: () => {
            pinRef.current = null
          },
        })
      : null

    setLoadingOlder(true)
    try {
      const res = await loadOlderMessages({ conversationId, before: cursor })
      if (!res.ok) {
        pinRef.current?.release()
        toast.error("Eski mesajlar yüklenemedi", { description: res.error })
        return
      }
      setLoadedPages((prev) => mergeThreadMessages(prev, res.page.messages))
      setCursor(res.page.nextCursor)
    } finally {
      setLoadingOlder(false)
    }
  }, [conversationId, cursor, loadingOlder])

  // A history pin outlives the render that started it, so leaving the thread
  // mid-insert would leave it holding a viewport that is no longer on screen.
  useEffect(() => () => pinRef.current?.release(), [])

  // The lock is only believed as long as the claim believes it: a turn that died
  // leaves its timestamp behind, and "yazıyor…" would hang there forever. One
  // re-render scheduled at expiry retires the line on its own.
  const [clockTick, setClockTick] = useState(() => Date.now())
  const assistantTyping = isAssistantTyping(turnLockedAt, clockTick)
  useEffect(() => {
    if (!turnLockedAt) return
    const expiresIn =
      new Date(turnLockedAt).getTime() + TURN_LOCK_TTL_MS - Date.now()
    const timer = setTimeout(() => setClockTick(Date.now()), Math.max(0, expiresIn))
    return () => clearTimeout(timer)
  }, [turnLockedAt])

  const isClosed = conversation.status === "closed"
  const isBot = conversation.status === "bot"
  const isPinned = conversation.pinnedAt != null
  const needsHuman = conversation.status === "needs_human"

  const displayName =
    conversation.guestName || formatPhoneDisplay(conversation.guestPhone)
  const subtitle = needsHuman
    ? formatWaitDuration(conversation.lastMessageAt)
    : formatPhoneDisplay(conversation.guestPhone)
  const waHref = toWhatsAppHref(conversation.guestPhone)

  const matchedMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return messages.filter((m) => m.body.toLowerCase().includes(q))
  }, [messages, searchQuery])

  function jumpToMessage(id: string) {
    setSearchOpen(false)
    setSearchQuery("")
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ block: "center", behavior: "smooth" })
    el.classList.add("ring-2", "ring-ring", "ring-offset-2", "rounded-2xl")
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-ring", "ring-offset-2", "rounded-2xl")
    }, 1600)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-[68px] shrink-0 items-center gap-3 px-4 sm:px-6">
        {/* Left: identity (display only) */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ContactAvatar
            variant="with-channel"
            channelKind={conversation.channelKind}
            size="md"
            seed={conversation.guestPhone}
          />

          <div className="flex min-w-0 flex-col">
            {/* Chrome, not content: the header labels the thread, the bubbles
                carry it. One step under the message text keeps that order. */}
            <span className="truncate text-sm font-semibold leading-tight">
              {displayName}
            </span>
            <span
              className={cn(
                "truncate text-xs",
                needsHuman ? "text-destructive font-medium" : "text-muted-foreground"
              )}
            >
              {subtitle}
            </span>
          </div>
        </div>

        {/* Right: primary CTA + icon toolbar */}
        <TooltipProvider>
        <div className="flex shrink-0 items-center gap-1.5">
          {!isClosed &&
            (isBot ? (
              <Button
                size="sm"
                variant={needsHuman ? "default" : "outline"}
                onClick={onTakeover}
                disabled={pending}
              >
                <Headset data-icon="inline-start" /> Devral
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={onBackToBot}
                disabled={pending}
              >
                <Bot data-icon="inline-start" /> Bota ver
              </Button>
            ))}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSearchOpen(true)}
                aria-label="Konuşmada ara"
              >
                <Search />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Konuşmada ara</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onTogglePanel}
                aria-pressed={panelOpen}
                aria-label={panelOpen ? "Rehber kartını kapat" : "Rehber kartını aç"}
              >
                {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {panelOpen ? "Rehber kartını kapat" : "Rehber kartını aç"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Diğer işlemler">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Diğer işlemler</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                {!isClosed && (
                  <DropdownMenuItem onClick={onClose} disabled={pending}>
                    <Check /> Konuşmayı kapat
                  </DropdownMenuItem>
                )}
                {isClosed && (
                  <DropdownMenuItem onClick={onTakeover} disabled={pending}>
                    <RotateCcw /> Yeniden aç
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onTogglePin(conversation.id, !isPinned)}
                  disabled={pending}
                >
                  {isPinned ? <PinOff /> : <Pin />}
                  {isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {waHref && (
                  <DropdownMenuItem asChild>
                    <a href={waHref} target="_blank" rel="noopener noreferrer">
                      <ExternalLink /> {channelLabel(conversation.channelKind)}’ta aç
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </TooltipProvider>
      </header>
      <Separator />

      <ThreadSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        results={matchedMessages}
        onJump={jumpToMessage}
      />

      <ThreadView
        rows={rows}
        typingSide={assistantTyping ? "end" : null}
        onLoadOlder={cursor ? loadOlder : undefined}
        loadingOlder={loadingOlder}
        onSourceClick={handleSourceClick}
        onConflictSourceClick={handleConflictSourceClick}
      />

      <Separator />
      <div className="px-6 py-4">
        <InputGroup className="mx-auto h-auto max-w-3xl items-end">
          <InputGroupTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder={
              isClosed ? "Konuşma kapalı" : "Misafire yanıt yaz…"
            }
            disabled={isClosed || pending}
            className="min-h-10"
            rows={1}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-sm"
              onClick={onSend}
              disabled={isClosed || pending || !draft.trim()}
              aria-label="Gönder"
            >
              {pending ? <Spinner /> : <SendHorizontal className="size-4" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground mx-auto mt-2 flex max-w-3xl items-center gap-1 text-xs">
          <CornerDownLeft className="size-3" /> Göndermek için ⌘/Ctrl + Enter.
          Yanıt yazınca konuşma ekibe geçer.
        </p>
      </div>

      {/* Opened by the Kaynaklar / Tutarsızlık chips under an assistant
          message. Lives here rather than beside the contact card so it is
          scoped to the thread it was opened from. */}
      <SourceDetailSheet
        source={sheetSource}
        open={sheetSource !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSheetSource(null)
            setHighlightQuery("")
          }
        }}
        slug={slug}
        folders={[]}
        highlightQuery={highlightQuery}
        onChanged={() => {}}
      />
    </section>
  )
}

interface ThreadSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (q: string) => void
  results: ThreadMessage[]
  onJump: (id: string) => void
}

function ThreadSearchDialog({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  onJump,
}: ThreadSearchDialogProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Konuşmada ara"
      description="Bu konuşmadaki mesajlarda ara."
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Mesajlarda ara…"
          value={query}
          onValueChange={onQueryChange}
        />
        <CommandList>
        {query.trim() === "" ? (
          <CommandEmpty>Aramak için yazmaya başla.</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        ) : (
          <CommandGroup heading={`${results.length} sonuç`}>
            {results.map((m) => (
              <CommandItem
                key={m.id}
                value={m.id}
                onSelect={() => onJump(m.id)}
                className="flex-col items-start gap-0.5"
              >
                <span className="text-muted-foreground text-xs">
                  {m.role === "assistant" || m.role === "staff"
                    ? "Biz"
                    : // A `system` row is something that happened to the
                      // conversation, not something the guest said. Without
                      // this it was attributed to them.
                      m.role === "system"
                      ? "Sistem"
                      : "Misafir"}{" "}
                  · {formatClockTr(m.createdAt)}
                </span>
                <span className="line-clamp-2 text-sm">{m.body}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
