"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Plus, Search, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { ContactCard as ContactCardModel } from "@/lib/supabase/queries/contacts"
import { ContactCard, ContactCardSkeleton } from "./contact-card"
import { ContactEditorSheet } from "./contact-editor-sheet"
import { loadContacts } from "./actions"

/**
 * Kişiler — everyone who has ever written to this organization, as cards.
 *
 * The first page is rendered on the server; search and "daha fazla" fetch the
 * rest through a server action rather than re-running the route, so typing does
 * not re-render the shell around the grid.
 */

interface Props {
  slug: string
  organizationId: string
  initialContacts: ContactCardModel[]
  initialTotal: number
  initialSearch: string
}

/** Cards drawn while a search is in flight — a page's worth, capped. */
const SEARCH_SKELETON_COUNT = 8

/**
 * Cards claim a real minimum width and share what is left, rather than being
 * cut from a fixed column count — the same grid then reads as one column on a
 * phone and as five on a wide monitor with nothing to switch between.
 */
const GRID_CLASSES =
  "grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-4"

export function ContactsClient({
  slug,
  organizationId,
  initialContacts,
  initialTotal,
  initialSearch,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [query, setQuery] = useState(initialSearch)
  const debouncedQuery = useDebouncedValue(query.trim())

  const [contacts, setContacts] = useState(initialContacts)
  const [total, setTotal] = useState(initialTotal)
  const [searching, setSearching] = useState(false)
  const [loadingMore, startLoadMore] = useTransition()

  const [editing, setEditing] = useState<ContactCardModel | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  /**
   * What the rows on screen were fetched for. The search effect compares
   * against it so the initial render — already served with these rows — does
   * not immediately refetch them.
   */
  const loadedSearch = useRef(initialSearch.trim())
  /** Only the newest search may write rows; a slower earlier one is dropped. */
  const requestId = useRef(0)

  useEffect(() => {
    if (debouncedQuery === loadedSearch.current) return

    const id = ++requestId.current
    setSearching(true)

    loadContacts({ organizationId, search: debouncedQuery, offset: 0 })
      .then((res) => {
        if (id !== requestId.current) return
        if (!res.ok) {
          toast.error("Kişiler yüklenemedi", { description: res.error })
          return
        }
        loadedSearch.current = debouncedQuery
        setContacts(res.page.rows)
        setTotal(res.page.total)
      })
      .finally(() => {
        if (id === requestId.current) setSearching(false)
      })

    // The address bar keeps the search, so a filtered list can be shared and
    // survives a reload.
    const params = debouncedQuery
      ? `?q=${encodeURIComponent(debouncedQuery)}`
      : ""
    router.replace(`${pathname}${params}`, { scroll: false })
  }, [debouncedQuery, organizationId, pathname, router])

  function loadMore() {
    startLoadMore(async () => {
      const res = await loadContacts({
        organizationId,
        search: loadedSearch.current,
        offset: contacts.length,
      })
      if (!res.ok) {
        toast.error("Kişiler yüklenemedi", { description: res.error })
        return
      }
      // Concurrent writes can shift rows between pages; the id set keeps a
      // contact from being drawn twice.
      setContacts((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return [...prev, ...res.page.rows.filter((c) => !seen.has(c.id))]
      })
      setTotal(res.page.total)
    })
  }

  const openEditor = useCallback((contact: ContactCardModel) => {
    setEditing(contact)
    setEditorOpen(true)
  }, [])

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }

  /**
   * Put the saved card back where it was, or on top when it is new — no
   * refetch, so the grid does not jump under the person who just saved.
   */
  function onSaved(saved: ContactCardModel) {
    // Decided out here, not inside the updater: an updater must be pure, and
    // React calls it more than once — a count bumped in there is bumped twice.
    const known = contacts.some((c) => c.id === saved.id)

    setContacts((prev) =>
      known
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [saved, ...prev]
    )
    if (!known) setTotal((count) => count + 1)
  }

  const hasMore = contacts.length < total
  const isSearch = query.trim() !== ""

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header strip: sidebar toggle + where we are */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-semibold tracking-tight">Kişiler</h1>
        <span className="text-muted-foreground text-xs">{total}</span>
      </header>

      {/* Toolbar: search + add */}
      <div className="flex shrink-0 items-center gap-2 px-4 py-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İsim, telefon veya e-posta ara"
            aria-label="Kişilerde ara"
            className="pl-9"
          />
          {searching && (
            <Spinner className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          )}
        </div>
        <Button onClick={openCreate} className="ml-auto">
          <Plus />
          Kişi ekle
        </Button>
      </div>

      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {searching && contacts.length === 0 ? (
          <div className={GRID_CLASSES}>
            {Array.from({ length: SEARCH_SKELETON_COUNT }).map((_, i) => (
              <ContactCardSkeleton key={i} />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {isSearch ? <Search /> : <Users />}
              </EmptyMedia>
              <EmptyTitle>
                {isSearch ? "Eşleşen kişi yok" : "Henüz kişi yok"}
              </EmptyTitle>
              <EmptyDescription>
                {isSearch
                  ? "Aramayı kısaltmayı deneyin ya da numarayı ülke koduyla yazın."
                  : "WhatsApp'a ilk mesaj geldiğinde kişi kartı kendiliğinden oluşur. Dilerseniz şimdiden elle ekleyebilirsiniz."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {isSearch ? (
                <Button variant="outline" onClick={() => setQuery("")}>
                  Aramayı temizle
                </Button>
              ) : (
                <Button onClick={openCreate}>
                  <Plus />
                  Kişi ekle
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className={GRID_CLASSES}>
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  slug={slug}
                  onEdit={openEditor}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center py-6">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? <Spinner /> : null}
                  Daha fazla yükle
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ContactEditorSheet
        open={editorOpen}
        contact={editing}
        organizationId={organizationId}
        slug={slug}
        onOpenChange={setEditorOpen}
        onSaved={onSaved}
      />
    </div>
  )
}
