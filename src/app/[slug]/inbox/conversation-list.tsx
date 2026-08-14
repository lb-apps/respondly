"use client"

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react"
import {
  ChevronDown,
  Pin,
  PinOff,
  Search,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  filterConversations,
  formatListTime,
  formatWaitDuration,
  type InboxFilter,
} from "@/lib/inbox/list-utils"
import { formatPhoneDisplay } from "@/lib/phone"
import type { ConversationListItem } from "@/lib/supabase/queries/inbox"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "unread", label: "Okunmamış" },
  { value: "needs_human", label: "Bekleyen" },
]

interface RowProps {
  item: ConversationListItem
  active: boolean
  onSelect: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
}

const ConversationRow = memo(function ConversationRow({
  item,
  active,
  onSelect,
  onTogglePin,
}: RowProps) {
  const displayName =
    item.guestName || formatPhoneDisplay(item.guestPhone)
  const isUnread = item.unreadCount > 0
  const isPinned = item.pinnedAt != null
  const needsHuman = item.status === "needs_human"

  return (
    <li
      className="[content-visibility:auto] [contain-intrinsic-size:auto_6rem] px-2"
      style={{ containIntrinsicSize: "auto 6rem" }}
    >
      <div
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-xl px-3 py-4 transition-colors",
          active && "bg-sidebar-active text-sidebar-active-foreground"
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-label={`${displayName} konuşmasını aç`}
          aria-current={active ? "true" : undefined}
        >
          <ContactAvatar
            variant="with-channel"
            channelKind={item.channelKind}
            channelPlacement="bottom-left"
            size="lg"
            // The person, not the thread: seeded by phone number so the same
            // guest wears the same avatar in every conversation they ever open.
            seed={item.guestPhone}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 pr-11">
              <span
                className={cn(
                  "truncate text-sm leading-none",
                  isUnread ? "font-semibold" : "font-medium"
                )}
              >
                {displayName}
              </span>
            </div>

            <div className="mt-1 flex items-start gap-1.5">
              <span
                // A step under the name on purpose: at the same size the two
                // lines competed and the row read as a wall of text.
                className={cn(
                  "line-clamp-2 min-w-0 flex-1 text-xs leading-snug",
                  isUnread && "font-medium",
                  // On the selected row the colour comes from the row itself.
                  // `muted-foreground` over `sidebar-active` is 3.97:1 in the
                  // light theme — under AA, and worse now that this line is
                  // 12.75px. Here the background already carries the emphasis.
                  active
                    ? "text-sidebar-active-foreground"
                    : isUnread
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {item.lastMessagePreview || "—"}
              </span>

              {isUnread ? (
                <Badge
                  variant="default"
                  className="size-5 shrink-0 justify-center rounded-full px-0 text-xs font-semibold tabular-nums"
                >
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </Badge>
              ) : needsHuman ? (
                <span className="text-destructive shrink-0 text-xs font-medium">
                  {formatWaitDuration(item.lastMessageAt)}
                </span>
              ) : null}
            </div>
          </div>
        </button>

        <div className="absolute top-4 right-3 flex items-center justify-end">
          <span
            className={cn(
              "text-xs leading-none font-medium tabular-nums",
              active ? "text-sidebar-active-foreground" : "text-muted-foreground"
            )}
          >
            {formatListTime(item.lastMessageAt)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-4.5 w-0 shrink-0 items-center justify-center overflow-hidden rounded-sm",
                  "border-2 border-background bg-muted text-muted-foreground shadow-sm",
                  "pointer-events-none scale-75 opacity-0",
                  "transition-[width,margin,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                  "group-hover:pointer-events-auto group-hover:ml-1 group-hover:w-4.5 group-hover:scale-100 group-hover:opacity-100",
                  "focus-visible:pointer-events-auto focus-visible:ml-1 focus-visible:w-4.5 focus-visible:scale-100 focus-visible:opacity-100",
                  "data-[state=open]:pointer-events-auto data-[state=open]:ml-1 data-[state=open]:w-4.5 data-[state=open]:scale-100 data-[state=open]:opacity-100"
                )}
                aria-label={`${displayName} için işlemler`}
                onClick={(e) => e.stopPropagation()}
              >
                <ChevronDown className="size-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => onTogglePin(item.id, !isPinned)}
              >
                {isPinned ? (
                  <>
                    <PinOff className="size-4" />
                    Sabitlemeyi kaldır
                  </>
                ) : (
                  <>
                    <Pin className="size-4" />
                    Sabitle
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
})

interface ConversationListProps {
  conversations: ConversationListItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onTogglePin,
}: ConversationListProps) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<InboxFilter>("all")
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(
    () => filterConversations(conversations, deferredQuery, filter),
    [conversations, deferredQuery, filter]
  )

  const handleFilterChange = useCallback((value: string) => {
    if (value) setFilter(value as InboxFilter)
  }, [])

  const unreadTotal = useMemo(
    () => conversations.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0),
    [conversations]
  )

  return (
    <aside className="flex h-full min-h-0 w-full max-w-sm shrink-0 flex-col overflow-hidden border-r">
      <div className="shrink-0 space-y-3 pt-3 pb-2">
        {unreadTotal > 0 ? (
          <div className="flex justify-end px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="tabular-nums">
                  {unreadTotal} okunmamış
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Okunmamış konuşma sayısı</TooltipContent>
            </Tooltip>
          </div>
        ) : null}

        <div className="px-2">
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bir şey ara"
              aria-label="Konuşmalarda ara"
            />
          </InputGroup>
        </div>

        <div className="px-5">
          <div className="overflow-x-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={handleFilterChange}
              variant="outline"
              size="sm"
              spacing={2}
              className="w-max min-w-full"
            >
              {FILTERS.map((f) => (
                <ToggleGroupItem
                  key={f.value}
                  value={f.value}
                  aria-label={f.label}
                  className="min-w-max flex-1 basis-0"
                >
                  {f.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {conversations.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            Henüz konuşma yok.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            Eşleşen konuşma yok.
          </p>
        ) : (
          <ul>
            {filtered.map((c) => (
              <ConversationRow
                key={c.id}
                item={c}
                active={c.id === activeId}
                onSelect={onSelect}
                onTogglePin={onTogglePin}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  )
}
