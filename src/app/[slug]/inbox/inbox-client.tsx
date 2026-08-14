"use client"

import {
  memo,
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
  MapPin,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { MessageChips } from "@/components/chat/message-chips"
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
  ThreadAttachment,
  ThreadCursor,
  ThreadMessage,
  ThreadSender,
} from "@/lib/supabase/queries/inbox"
import type { ContactDetail } from "@/lib/supabase/queries/contacts"
import { formatPhoneDisplay, toWhatsAppHref } from "@/lib/phone"
import {
  channelLabel,
  formatWaitDuration,
  groupByDay,
  initials,
  isAssistantTyping,
  mergeThreadMessages,
  TURN_LOCK_TTL_MS,
} from "@/lib/inbox/list-utils"
import { ContactDetailPanel } from "./contact-detail-panel"
import { ConversationList } from "./conversation-list"
import { ChatAttachmentGrid } from "@/components/chat/chat-attachments"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import {
  toCarouselMessage,
  type CarouselCardView,
} from "@/lib/whatsapp/carousel-message"
import { toChoiceMessage, type ChoiceMessage } from "@/lib/whatsapp/choice-message"
import { formatAssistantMessageText, extractImageUrls } from "@/lib/assistant/format-text"
import { WhatsAppFormattedText } from "@/components/chat/whatsapp-formatted-text"
import { StickyDayHeading } from "@/components/chat/sticky-day-heading"
import {
  Bubble,
  MessageMeta,
  MessageRow,
  type MessageSide,
  type MessageSpeaker,
} from "@/components/chat/message-row"
import {
  ThreadColumn,
  ThreadDayGroup,
  ThreadScroller,
  ThreadTypingIndicator,
} from "@/components/chat/thread-surface"
import { pinScrollFromBottom, type ScrollPin } from "@/lib/inbox/pin-scroll"
import { ThreadEventDivider } from "@/components/chat/thread-event-divider"
import { RemoteImage } from "@/components/remote-image"
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

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
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

  function togglePanel() {
    setDetailOpen((open) => !open)
  }

  function select(id: string) {
    setReadOverrides((prev) => ({ ...prev, [id]: 0 }))
    startTransition(async () => {
      await markConversationRead({ conversationId: id, slug })
    })
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
            {thread ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {thread.conversation.guestName ||
                      formatPhoneDisplay(thread.conversation.guestPhone)}
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
        activeId={activeId}
        onSelect={select}
        onTogglePin={handleTogglePin}
      />

      {/* Thread */}
      {thread ? (
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement | null>(null)
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

  const dayGroups = useMemo(
    () => groupByDay(messages, (m) => m.createdAt),
    [messages]
  )

  const conversationId = conversation.id

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingOlder) return
    const viewport = viewportRef.current
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

  // Ask for the next page while the top of the thread is still a screen away,
  // so the reader meets messages rather than a spinner. An observer rather than
  // a scroll handler: the browser decides when to tell us, no per-frame work.
  useEffect(() => {
    const sentinel = topSentinelRef.current
    if (!sentinel || !cursor) return

    const root = sentinel.closest<HTMLElement>("[data-slot=scroll-area-viewport]")
    if (!root) return
    viewportRef.current = root

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadOlder()
      },
      { root, rootMargin: "600px 0px 0px 0px", threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [cursor, loadOlder])

  // The browser's own scroll anchoring would compensate for the same insertion
  // a second time, on top of the pin, and the view would move twice as far.
  // `overflow-anchor: none` on the viewport (see the ScrollArea below) hands
  // the job to the pin alone — and to Safari, which has no scroll anchoring to
  // undo in the first place, it changes nothing.
  useEffect(() => () => pinRef.current?.release(), [])

  // Jump to the newest message when one arrives — keyed on its id, not on the
  // count: prepending a page of history also changes the count, and scrolling
  // to the bottom then would throw the reader out of the place they scrolled to.
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

  const latestMessageId = messages[messages.length - 1]?.id
  useEffect(() => {
    // Never while a page of history is being inserted: the reader is up there
    // reading it, and the newest message is not what they asked for.
    if (pinRef.current?.active) return
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [latestMessageId])

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

      <ThreadScroller>
        <ThreadColumn>
          {/* Where the thread continues upwards. The sentinel sits above the
              spinner so it enters the viewport first and the page is already
              on its way by the time anything is shown. */}
          <div ref={topSentinelRef} aria-hidden className="h-px w-full shrink-0" />
          {loadingOlder ? (
            <div
              className="flex justify-center pb-4"
              role="status"
              aria-label="Eski mesajlar yükleniyor"
            >
              <Spinner className="text-muted-foreground" />
            </div>
          ) : null}
          {dayGroups.map((group) => (
            <ThreadDayGroup key={group.key}>
              <StickyDayHeading label={group.label} />
              {group.items.map((m) =>
                m.event ? (
                  <ThreadEventDivider
                    key={m.id}
                    kind={m.event.kind}
                    actorName={m.sender?.name}
                    createdAt={m.createdAt}
                  />
                ) : (
                <MessageBubble
                  key={m.id}
                  messageId={m.id}
                  role={m.role}
                  body={m.body}
                  type={m.type}
                  createdAt={m.createdAt}
                  richContent={m.richContent}
                  toolTrace={m.toolTrace}
                  onSourceClick={handleSourceClick}
                  onConflictSourceClick={handleConflictSourceClick}
                  attachments={m.attachments}
                  sender={m.sender}
                  guestName={conversation.guestName}
                  guestPhone={conversation.guestPhone}
                  avatarSeed={conversation.guestPhone}
                />
                )
              )}
            </ThreadDayGroup>
          ))}
          {assistantTyping ? <ThreadTypingIndicator /> : null}
          <div ref={bottomRef} />
        </ThreadColumn>
      </ThreadScroller>

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
                    : "Misafir"}{" "}
                  · {formatTime(m.createdAt)}
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

type InboxRichItem =
  | { type: "image"; imageUrl: string; caption?: string }
  | { type: "quick_reply"; body: string; buttons: string[] }
  | { type: "cta"; body: string; url: string }
  | { type: "carousel"; body: string; cards: CarouselCardView[] }
  | ChoiceMessage
  | { type: "location_request"; body: string }
  | {
      type: "location"
      latitude: number
      longitude: number
      name?: string
      address?: string
    }

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null
}

function parseRichContent(raw: unknown[] | null | undefined): InboxRichItem[] {
  if (!raw) return []
  const items: InboxRichItem[] = []
  for (const entry of raw) {
    const r = asRecord(entry)
    if (!r) continue
    if (r.type === "image" && typeof r.imageUrl === "string") {
      // Captions only exist on rows stored before they were dropped; new
      // messages send the picture on its own.
      const caption = typeof r.caption === "string" ? r.caption : undefined
      items.push({ type: "image", imageUrl: r.imageUrl, caption })
    } else if (r.type === "quick_reply" && Array.isArray(r.buttons)) {
      items.push({
        type: "quick_reply",
        body: typeof r.body === "string" ? r.body : "",
        buttons: (r.buttons as unknown[]).filter((b): b is string => typeof b === "string"),
      })
    } else if (r.type === "cta" && typeof r.url === "string") {
      items.push({ type: "cta", body: typeof r.body === "string" ? r.body : "", url: r.url })
    } else if (r.type === "carousel") {
      // Stored exactly as it was sent, so the same reader that built the
      // message rebuilds it here — staff see the cards the guest saw.
      const carousel = toCarouselMessage(r)
      if (carousel) items.push(carousel)
    } else if (r.type === "choice") {
      // Same one-reader-two-renderers pattern as the carousel above.
      const choice = toChoiceMessage(r)
      if (choice) items.push(choice)
    } else if (r.type === "location_request") {
      items.push({
        type: "location_request",
        body: typeof r.body === "string" ? r.body : "",
      })
    } else if (
      r.type === "location" &&
      typeof r.latitude === "number" &&
      typeof r.longitude === "number"
    ) {
      items.push({
        type: "location",
        latitude: r.latitude,
        longitude: r.longitude,
        name: typeof r.name === "string" ? r.name : undefined,
        address: typeof r.address === "string" ? r.address : undefined,
      })
    }
  }
  return items
}

/**
 * How long the scroll anchor is held after older messages are prepended — long
 * enough for the images in them to decode and settle, short enough that it can
 * never fight a scroll the reader makes themselves.
 */


const MessageBubble = memo(function MessageBubble({
  messageId,
  role,
  body,
  createdAt,
  richContent,
  toolTrace,
  onSourceClick,
  onConflictSourceClick,
  attachments = [],
  guestName,
  guestPhone,
  avatarSeed,
  sender,
}: {
  messageId: string
  role: string
  body: string
  type?: string
  createdAt: string
  richContent?: unknown[] | null
  toolTrace?: unknown[] | null
  onSourceClick?: (id: string) => void
  onConflictSourceClick?: (sourceId: string, highlight: string) => void
  attachments?: ThreadAttachment[]
  guestName: string | null
  guestPhone: string
  /** Seeds the guest's generated avatar — their phone number, so it never
   *  changes with the conversation it appears in. */
  avatarSeed: string
  /** The teammate who wrote this, when a person did. */
  sender?: ThreadSender | null
}) {
  const isGuest = role === "guest"
  const isSystem = role === "system"

  if (isSystem) {
    return (
      <div className="text-muted-foreground py-1 text-center text-xs">{body}</div>
    )
  }

  const richItems = isGuest ? [] : parseRichContent(richContent)
  const textImageUrls = isGuest || role === "staff" ? [] : extractImageUrls(body)
  const mergedRichItems =
    textImageUrls.length > 0
      ? [
          ...richItems,
          ...textImageUrls
            .filter(
              (url) =>
                !richItems.some(
                  (r) => r.type === "image" && r.imageUrl === url
                )
            )
            .map((url) => ({ type: "image" as const, imageUrl: url, caption: "" })),
        ]
      : richItems
  const displayBody =
    isGuest || role === "staff"
      ? body
      : formatAssistantMessageText(body, mergedRichItems)

  // Who is answering, said once and read two ways: the avatar carries it at a
  // glance, the line under the bubble spells it out. A person gets their own
  // photo — two similar glyphs in the same grey circle were not a distinction.
  const isStaff = role === "staff"
  const senderName = isStaff ? (sender?.name ?? null) : null
  const senderLabel = isStaff ? (senderName ?? "Ekip") : "Asistan"
  const outboundIcon =
    isStaff && !senderName ? (
      <Headset className="size-3.5" />
    ) : isStaff ? (
      initials(senderName, "")
    ) : (
      <Bot className="size-3.5" />
    )

  const side: MessageSide = isGuest ? "start" : "end"
  const speaker: MessageSpeaker = isGuest ? "contact" : "business"

  const messageBody = (
    <>
      {attachments.length > 0 && (
        <ChatAttachmentGrid
          attachments={attachments.map((a) => ({
            kind: a.kind as "image" | "document",
            filename: a.filename,
            mimeType: a.mimeType,
            signedUrl: a.signedUrl,
          }))}
        />
      )}
      {displayBody ? (
        <Bubble speaker={speaker} side={side}>
          <WhatsAppFormattedText text={displayBody} />
        </Bubble>
      ) : null}
      {mergedRichItems.map((item, i) => {
        if (item.type === "image") {
          return (
            <div
              key={i}
              className={cn(
                "overflow-hidden",
                isGuest
                  ? "rounded-2xl rounded-bl-sm border border-border bg-card"
                  : "rounded-2xl rounded-br-sm bg-primary"
              )}
            >
              <RemoteImage
                src={item.imageUrl}
                alt={item.caption}
                className="max-h-48 w-full object-cover"
              />
              {item.caption ? (
                <div className="text-muted-foreground border-t px-4 py-2 text-xs">
                  <WhatsAppFormattedText text={item.caption} />
                </div>
              ) : null}
            </div>
          )
        }
        if (item.type === "quick_reply") {
          return (
            <div key={i} className="flex flex-wrap gap-2">
              {item.buttons.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs text-muted-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          )
        }
        if (item.type === "carousel") {
          return (
            <Carousel
              key={i}
              opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
              className="w-full min-w-0"
            >
              <CarouselContent className="-ml-2">
                {item.cards.map((card) => (
                  <CarouselItem key={card.id} className="basis-44 pl-2">
                    <div className="border-border flex h-full flex-col overflow-hidden rounded-2xl border">
                      <RemoteImage
                        src={card.imageUrl}
                        className="h-24 w-full object-cover"
                      />
                      {card.body ? (
                        <div className="bg-card text-card-foreground grow px-2.5 py-2 text-xs">
                          <WhatsAppFormattedText text={card.body} />
                        </div>
                      ) : null}
                      {card.buttons.map((button) => (
                        <span
                          key={button.label}
                          className="bg-card text-primary border-t px-2.5 py-2 text-center text-xs font-medium"
                        >
                          {button.label}
                        </span>
                      ))}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          )
        }
        if (item.type === "cta") {
          return (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Rezervasyon Yap <ExternalLink className="size-3" />
            </a>
          )
        }
        if (item.type === "choice") {
          // Static on purpose: staff are reading what the guest was offered,
          // not answering it.
          return (
            <div key={i} className="flex flex-col gap-1.5">
              {item.body ? (
                <Bubble speaker={speaker} side={side}>
                  <WhatsAppFormattedText text={item.body} />
                </Bubble>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {item.options.map((option) => (
                  <span
                    key={option.id}
                    className="border-border/80 bg-background text-muted-foreground rounded-full border px-3 py-1 text-xs"
                  >
                    {option.label}
                    {option.description ? (
                      <span className="text-muted-foreground/70"> · {option.description}</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          )
        }
        if (item.type === "location") {
          const label = item.name || item.address || "Konum"
          return (
            <a
              key={i}
              href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-card flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs"
            >
              <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{label}</span>
                {item.address && item.address !== label ? (
                  <span className="text-muted-foreground line-clamp-2">{item.address}</span>
                ) : null}
              </span>
            </a>
          )
        }
        if (item.type === "location_request") {
          return (
            <div key={i} className="flex flex-col gap-1.5">
              {item.body ? (
                <Bubble speaker={speaker} side={side}>
                  <WhatsAppFormattedText text={item.body} />
                </Bubble>
              ) : null}
              <span className="border-border/80 bg-background text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                <MapPin className="size-3" /> Konum isteği
              </span>
            </div>
          )
        }
        return null
      })}
      {!isGuest && role !== "staff" && (
        // Same component the preview renders, fed from `messages.tool_trace`
        // instead of a live turn's parts — one implementation, so the two
        // surfaces cannot drift.
        <MessageChips
          parts={toolTrace ?? []}
          onSourceClick={onSourceClick}
          onConflictSourceClick={onConflictSourceClick}
        />
      )}
    </>
  )

  return (
    <MessageRow
      id={`msg-${messageId}`}
      side={side}
      avatar={
        isGuest ? (
          <ContactAvatar variant="plain" size="sm" seed={avatarSeed} />
        ) : (
          <ContactAvatar
            variant="plain"
            size="sm"
            seed={isStaff && senderName ? senderName : undefined}
            imageUrl={isStaff ? sender?.avatarUrl : null}
            imageAlt={senderName ?? ""}
            fallbackClassName={
              isStaff && senderName ? undefined : "bg-muted text-muted-foreground"
            }
          >
            {outboundIcon}
          </ContactAvatar>
        )
      }
      meta={
        // The guest needs no byline: the avatar and the side already say it is
        // them. Which of us answered is not so obvious, so that side is named.
        <MessageMeta
          label={isGuest ? null : senderLabel}
          time={formatTime(createdAt)}
          dateTime={createdAt}
        />
      }
    >
      {messageBody}
    </MessageRow>
  )
})
