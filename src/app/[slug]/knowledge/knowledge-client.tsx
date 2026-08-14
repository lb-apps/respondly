"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  BookText,
  ListFilter,
  PanelRight,
  MoreHorizontal,
  Move,
  Pencil,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"
import {
  IconBookFilled,
  IconFileCodeFilled,
  IconFileDescriptionFilled,
  IconFileTextFilled,
  IconFileTypographyFilled,
  IconWorldFilled,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  KNOWLEDGE_LIBRARY_DESCRIPTION,
  KNOWLEDGE_LIBRARY_LABEL,
} from "@/lib/knowledge/constants"
import { formatDateTimeTr } from "@/lib/format/datetime"
import { useRealtimeSync } from "@/hooks/use-realtime-sync"
import { useProcessingPoll } from "@/hooks/use-processing-poll"
import { cn } from "@/lib/utils"
import type {
  FolderOption,
  FolderRow,
  SourceRow,
} from "@/lib/supabase/queries/knowledge"
import {
  folderTypeIcon,
  formatBytes,
  itemCountLabel,
  kindLabel,
  sourceTypeFacetIcons,
} from "./knowledge-meta"
import { AddUrlDialog } from "./add-url-dialog"
import { AddFilesDialog } from "./add-files-dialog"
import { CreateTextDialog } from "./create-text-dialog"
import { CreateFolderDialog } from "./create-folder-dialog"
import { MoveDialog } from "./move-dialog"
import { RenameFolderDialog } from "./rename-folder-dialog"
import { SourceDetailSheet } from "./source-detail-sheet"
import { SidebarRowIcon } from "./sidebar-row-icon"
import { StoragePill } from "./storage-pill"
import { FacetFilter, type FacetOption } from "./facet-filter"
import { deleteItems, searchSourceContent } from "./actions"

/**
 * Filled glyph for a source row. Declared at module scope (not derived during
 * render) so it has a stable identity — satisfies react-hooks/static-components.
 */
function SourceGlyph({
  kind,
  ext,
  className,
}: {
  kind: string
  ext: string | null
  className?: string
}) {
  if (kind === "link") return <IconWorldFilled className={className} />
  if (kind === "text") return <IconFileTypographyFilled className={className} />
  switch ((ext ?? "").toLowerCase()) {
    case "html":
      return <IconFileCodeFilled className={className} />
    case "epub":
      return <IconBookFilled className={className} />
    case "docx":
      return <IconFileDescriptionFilled className={className} />
    default:
      return <IconFileTextFilled className={className} />
  }
}

const TYPE_OPTIONS: FacetOption[] = [
  { value: "file", label: "Dosya", icon: sourceTypeFacetIcons.file },
  { value: "link", label: "Bağlantı", icon: sourceTypeFacetIcons.link },
  { value: "text", label: "Metin", icon: sourceTypeFacetIcons.text },
]
const EMPTY_CONTENT_MATCHES = new Map<string, string>()

/** Fixed layout: side columns sized via colgroup; name column absorbs the rest. */
const KNOWLEDGE_TABLE_CLASS = "table-fixed w-full"

const KNOWLEDGE_COL_CHECK =
  "w-14 px-0 pr-0 pl-6 [&:has([role=checkbox])]:pr-0"
const KNOWLEDGE_COL_NAME = "max-w-0 overflow-hidden px-4"
const KNOWLEDGE_COL_CREATOR = "hidden px-4 sm:table-cell"
const KNOWLEDGE_COL_DATE = "hidden px-4 md:table-cell"
const KNOWLEDGE_COL_MENU = "w-18 px-3 pr-6 pl-2"
const KNOWLEDGE_HEADER_ROW_CLASS = "hover:bg-transparent"

/** Inbox-style row highlight: inset from the container edges + rounded. */
const KNOWLEDGE_ROW_CLASS = cn(
  "cursor-pointer border-0 hover:bg-transparent has-aria-expanded:bg-transparent",
  "[&>td]:transition-colors",
  "hover:[&>td]:bg-muted/60 [&:has([aria-expanded=true])>td]:bg-muted/60",
  "[&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
)

function KnowledgeColgroup() {
  return (
    <colgroup>
      <col className="w-14" />
      <col />
      <col className="hidden w-44 sm:table-column" />
      <col className="hidden w-48 md:table-column" />
      <col className="w-18" />
    </colgroup>
  )
}

interface Props {
  slug: string
  organizationId: string
  assistantId: string | null
  folderId: string | null
  currentFolderName: string | null
  parentFolderId: string | null
  ancestors: { id: string; name: string }[]
  folders: FolderRow[]
  sources: SourceRow[]
  allFolders: FolderOption[]
  usage: { used: number; quota: number }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "failed") return <Badge variant="destructive">Başarısız</Badge>
  if (status === "processing")
    return (
      <Badge variant="outline" className="gap-1">
        <Spinner className="size-3" /> İşleniyor
      </Badge>
    )
  return null
}

export function KnowledgeClient({
  slug,
  organizationId,
  assistantId,
  folderId,
  currentFolderName,
  parentFolderId,
  ancestors,
  folders,
  sources,
  allFolders,
  usage,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [creatorFilter, setCreatorFilter] = useState<Set<string>>(new Set())

  // Server-side content search: source id → excerpt around the first match.
  const [contentMatches, setContentMatches] = useState<Map<string, string>>(
    new Map()
  )
  const [searching, setSearching] = useState(false)
  const [contentSearchQuery, setContentSearchQuery] = useState("")
  const sourceIdsKey = useMemo(
    () => sources.map((s) => s.id).join(","),
    [sources]
  )

  // Debounced content search. Title matching stays client-side; this only adds
  // body matches (e.g. "Oto" inside a doc whose title differs).
  useEffect(() => {
    const q = query.trim()
    const ids = sourceIdsKey ? sourceIdsKey.split(",") : []
    let cancelled = false
    const timer = setTimeout(async () => {
      if (q.length < 2 || ids.length === 0) {
        if (!cancelled) {
          setContentMatches(new Map())
          setContentSearchQuery(q)
          setSearching(false)
        }
        return
      }
      setSearching(true)
      const matched = await searchSourceContent(organizationId, ids, q)
      if (!cancelled) {
        setContentMatches(new Map(matched.map((m) => [m.sourceId, m.snippet])))
        setContentSearchQuery(q)
        setSearching(false)
      }
    }, q.length < 2 ? 0 : 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, organizationId, sourceIdsKey])
  const normalizedQuery = query.trim()
  const contentSearchPending =
    normalizedQuery.length >= 2 &&
    sourceIdsKey !== "" &&
    contentSearchQuery !== normalizedQuery
  const searchLoading = searching || contentSearchPending
  const visibleContentMatches =
    contentSearchQuery === normalizedQuery ? contentMatches : EMPTY_CONTENT_MATCHES

  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [moveOpen, setMoveOpen] = useState(false)
  // Track the open source by id (not a snapshot) so the sheet reflects live
  // status/chunk updates after a Realtime refresh, and auto-closes if the row
  // is removed (e.g. quota eviction). Resolved against the full source list so
  // an active title/content search doesn't close it.
  const [detailSourceId, setDetailSourceId] = useState<string | null>(null)
  const detailSource = useMemo(
    () => sources.find((s) => s.id === detailSourceId) ?? null,
    [sources, detailSourceId]
  )
  const [renameFolder, setRenameFolder] = useState<{
    id: string
    name: string
  } | null>(null)

  function clearSelection() {
    setSelectedFolders(new Set())
    setSelectedSources(new Set())
  }

  const refresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  // Background indexing flips status processing→ready/failed without a user
  // action. Realtime gives an instant nudge when it lands; the poll below is
  // the deterministic guarantee that the UI converges even if a realtime event
  // is missed (RLS/replica-identity edge cases on UPDATE).
  useRealtimeSync({
    channelName: `knowledge-${organizationId}`,
    tables: ["knowledge_sources"],
    filter: `organization_id=eq.${organizationId}`,
    onSync: refresh,
  })

  // Poll only while something is indexing; self-terminates the moment every row
  // is ready/failed. This is a real external-system sync (a background job), so
  // an interval-driven effect is the right tool.
  const hasProcessing = useMemo(
    () => sources.some((s) => s.status === "processing"),
    [sources]
  )
  useProcessingPoll(hasProcessing, refresh)

  function navigateTo(id: string | null) {
    clearSelection()
    router.push(id ? `/${slug}/knowledge?folder=${id}` : `/${slug}/knowledge`)
  }

  // Filtered folders (always above sources), name-only search, A→Z.
  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = folders
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q))
    if (creatorFilter.size > 0)
      list = list.filter(
        (f) => f.created_by && creatorFilter.has(f.created_by)
      )
    // Folders excluded by an active Type filter (Type filters sources only).
    if (typeFilter.size > 0) list = []
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "tr"))
  }, [folders, query, creatorFilter, typeFilter])

  // Sources: type/creator filters first, then search matches title OR content.
  const visibleSources = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = sources
    if (typeFilter.size > 0) list = list.filter((s) => typeFilter.has(s.kind))
    if (creatorFilter.size > 0)
      list = list.filter(
        (s) => s.created_by && creatorFilter.has(s.created_by)
      )
    if (q)
      list = list.filter(
        (s) => s.title.toLowerCase().includes(q) || visibleContentMatches.has(s.id)
      )
    return [...list].sort((a, b) => a.title.localeCompare(b.title, "tr"))
  }, [sources, query, typeFilter, creatorFilter, visibleContentMatches])

  // Creator filter options — distinct creators across this folder's items.
  // Derived from the data we already have (no members query / RPC).
  const creatorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of folders)
      if (f.created_by) map.set(f.created_by, f.creatorName ?? "—")
    for (const s of sources)
      if (s.created_by) map.set(s.created_by, s.creatorName ?? "—")
    return [...map].map(([userId, name]) => ({ userId, name }))
  }, [folders, sources])

  const totalVisible = visibleFolders.length + visibleSources.length
  const selectedCount = selectedFolders.size + selectedSources.size
  // Header checkbox: empty → select all; any selection (partial or full) → minus, click clears.
  const headerCheckboxChecked: boolean | "indeterminate" =
    selectedCount > 0 && totalVisible > 0 ? "indeterminate" : false

  function toggleAllHeader() {
    if (selectedCount > 0) clearSelection()
    else {
      setSelectedFolders(new Set(visibleFolders.map((f) => f.id)))
      setSelectedSources(new Set(visibleSources.map((s) => s.id)))
    }
  }

  function toggleFolder(id: string, on: boolean) {
    setSelectedFolders((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSource(id: string, on: boolean) {
    setSelectedSources((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function doDelete(folderIds: string[], sourceIds: string[]) {
    startTransition(async () => {
      const res = await deleteItems({ slug, folderIds, sourceIds })
      if (!res.ok) toast.error("Hata", { description: res.error })
      else {
        toast.success("Silindi")
        clearSelection()
        refresh()
      }
    })
  }

  const onDone = () => refresh()
  const isEmpty = totalVisible === 0
  const hasFilters =
    query.trim() !== "" || typeFilter.size > 0 || creatorFilter.size > 0
  const filteredEmptyDescription = (() => {
    const q = query.trim()
    if (q) {
      return `"${q}" araması için bir sonuç bulunamadı. Farklı bir şeyler aramayı deneyin.`
    }
    return "Seçili filtrelere uygun sonuç bulunamadı. Farklı filtreler deneyin."
  })()

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header strip: sidebar toggle + breadcrumb */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {folderId === null ? (
                <BreadcrumbPage>{KNOWLEDGE_LIBRARY_LABEL}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={`/${slug}/knowledge`}>{KNOWLEDGE_LIBRARY_LABEL}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {ancestors.map((a, i) => {
              const last = i === ancestors.length - 1
              return (
                <span key={a.id} className="flex items-center gap-1.5">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {last ? (
                      <BreadcrumbPage>{a.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={`/${slug}/knowledge?folder=${a.id}`}>
                          {a.name}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-hidden p-6 lg:p-8">
        {/* Title row + storage pill */}
        <div className="mb-6 flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {currentFolderName ?? KNOWLEDGE_LIBRARY_LABEL}
              </h1>
              {pending && <Spinner className="size-4 text-muted-foreground" />}
            </div>
            {folderId === null && (
              <p className="max-w-2xl text-base text-muted-foreground">
                {KNOWLEDGE_LIBRARY_DESCRIPTION}
              </p>
            )}
          </div>
          <StoragePill used={usage.used} quota={usage.quota} />
        </div>

        {/* Action bar → search/filters → table */}
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="flex shrink-0 flex-wrap gap-3">
          <AddUrlDialog
            slug={slug}
            organizationId={organizationId}
            assistantId={assistantId}
            defaultFolderId={folderId}
            folders={allFolders}
            onDone={onDone}
          />
          <AddFilesDialog
            slug={slug}
            organizationId={organizationId}
            assistantId={assistantId}
            defaultFolderId={folderId}
            folders={allFolders}
            onDone={onDone}
          />
          <CreateTextDialog
            slug={slug}
            organizationId={organizationId}
            assistantId={assistantId}
            defaultFolderId={folderId}
            folders={allFolders}
            onDone={onDone}
          />
          <CreateFolderDialog
            slug={slug}
            organizationId={organizationId}
            defaultFolderId={folderId}
            folders={allFolders}
            onDone={onDone}
          />
        </div>

        {/* Toolbar: search + sort, then a faceted filter row */}
        <div className="flex shrink-0 flex-col gap-2.5">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Başlık veya içerikte ara…"
              className="pl-9"
            />
            {searchLoading && (
              <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCount > 0 ? (
              // Selection takes over the chip row: a compact "N seçili" chip
              // with its actions; facet filters hide until selection clears.
              <>
                <div className="inline-flex h-8 items-center overflow-hidden rounded-2xl border border-input bg-input/50 text-sm">
                  <button
                    type="button"
                    onClick={clearSelection}
                    aria-label="Seçimi temizle"
                    className="flex h-full items-center px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                  <span className="flex h-full items-center gap-1.5 border-l pr-2.5 pl-2.5">
                    <span className="text-muted-foreground">Seçili</span>
                    <Badge variant="secondary" className="px-1.5 tabular-nums">
                      {selectedCount}
                    </Badge>
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setMoveOpen(true)}
                >
                  <Move className="size-3.5" /> Taşı
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-destructive hover:text-destructive"
                  onClick={() =>
                    doDelete([...selectedFolders], [...selectedSources])
                  }
                >
                  <Trash2 className="size-3.5" /> Sil
                </Button>
              </>
            ) : (
              <>
                <FacetFilter
                  label="Tür"
                  icon={ListFilter}
                  unitLabel="tür"
                  options={TYPE_OPTIONS}
                  selected={typeFilter}
                  onChange={setTypeFilter}
                />
                <FacetFilter
                  label="Oluşturan"
                  icon={Users}
                  unitLabel="kişi"
                  options={creatorOptions.map((m) => ({
                    value: m.userId,
                    label: m.name,
                  }))}
                  selected={creatorFilter}
                  onChange={setCreatorFilter}
                />
              </>
            )}
          </div>
        </div>

        {/* Table, search skeleton, or empty state — fills remaining viewport height */}
        <div className="flex min-h-0 flex-1 flex-col">
        {searchLoading && isEmpty ? (
          <KnowledgeTableSkeleton />
        ) : isEmpty ? (
          <Empty className="min-h-0 flex-1 rounded-xl border border-dashed border-border/70 bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookText />
              </EmptyMedia>
              {folderId === null ? (
                <>
                  <EmptyTitle>
                    {hasFilters ? "Sonuç Bulunamadı" : "Henüz belge yok"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? filteredEmptyDescription
                      : "İlk kaynağını ekleyerek başla."}
                  </EmptyDescription>
                </>
              ) : (
                <>
                  <EmptyTitle>
                    {hasFilters ? "Sonuç Bulunamadı" : "Belge bulunamadı"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? filteredEmptyDescription
                      : "Bu klasörde henüz belge yok."}
                  </EmptyDescription>
                </>
              )}
            </EmptyHeader>
            {folderId !== null && !hasFilters && (
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo(parentFolderId)}
                  className="gap-1.5"
                >
                  <ArrowLeft className="size-3.5" /> Üst klasöre dön
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-border/70 bg-muted/20 p-2 [&_tbody_[data-slot=table-row]]:border-0 [&_tbody_[data-slot=table-row]_td]:py-3!">
            <Table className={KNOWLEDGE_TABLE_CLASS}>
              <KnowledgeColgroup />
              <TableHeader>
                <TableRow className={KNOWLEDGE_HEADER_ROW_CLASS}>
                  <TableHead className={KNOWLEDGE_COL_CHECK}>
                    <Checkbox
                      checked={headerCheckboxChecked}
                      onCheckedChange={toggleAllHeader}
                      aria-label={
                        selectedCount > 0
                          ? "Tüm seçimi kaldır"
                          : "Tümünü seç"
                      }
                      className="size-5"
                    />
                  </TableHead>
                  <TableHead className={KNOWLEDGE_COL_NAME}>Ad</TableHead>
                  <TableHead className={KNOWLEDGE_COL_CREATOR}>
                    Oluşturan
                  </TableHead>
                  <TableHead className={KNOWLEDGE_COL_DATE}>
                    Son güncelleme
                  </TableHead>
                  <TableHead className={KNOWLEDGE_COL_MENU} />
                </TableRow>
              </TableHeader>
              <TableBody>
                <tr aria-hidden="true">
                  <td className="h-2 p-0" colSpan={5} />
                </tr>
                {visibleFolders.map((f) => (
                  <FolderRowItem
                    key={f.id}
                    folder={f}
                    selected={selectedFolders.has(f.id)}
                    onToggle={(on) => toggleFolder(f.id, on)}
                    onOpen={() => navigateTo(f.id)}
                    onRename={() =>
                      setRenameFolder({ id: f.id, name: f.name })
                    }
                    onDelete={() => doDelete([f.id], [])}
                  />
                ))}
                {visibleSources.map((s) => (
                  <SourceRowItem
                    key={s.id}
                    source={s}
                    snippet={visibleContentMatches.get(s.id)}
                    query={query.trim()}
                    selected={selectedSources.has(s.id)}
                    onToggle={(on) => toggleSource(s.id, on)}
                    onOpen={() => setDetailSourceId(s.id)}
                    onDelete={() => doDelete([], [s.id])}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </div>
        </div>
      </main>

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        slug={slug}
        organizationId={organizationId}
        folders={allFolders}
        folderIds={[...selectedFolders]}
        sourceIds={[...selectedSources]}
        onDone={() => {
          clearSelection()
          refresh()
        }}
      />

      {renameFolder && (
        <RenameFolderDialog
          open
          onOpenChange={(o) => {
            if (!o) setRenameFolder(null)
          }}
          folderId={renameFolder.id}
          currentName={renameFolder.name}
          slug={slug}
          onDone={refresh}
        />
      )}

      <SourceDetailSheet
        source={detailSource}
        open={detailSource !== null}
        onOpenChange={(o) => {
          if (!o) setDetailSourceId(null)
        }}
        slug={slug}
        folders={allFolders}
        onChanged={refresh}
        highlightQuery={query.trim()}
      />
    </div>
  )
}

function FolderRowItem({
  folder,
  selected,
  onToggle,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: FolderRow
  selected: boolean
  onToggle: (on: boolean) => void
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const FolderIcon = folderTypeIcon
  return (
    <TableRow className={KNOWLEDGE_ROW_CLASS} onClick={onOpen}>
      <TableCell
        className={KNOWLEDGE_COL_CHECK}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggle(Boolean(v))}
          aria-label="Satırı seç"
          className="size-5"
        />
      </TableCell>
      <TableCell className={KNOWLEDGE_COL_NAME}>
        <div className="flex items-center gap-2.5">
          <SidebarRowIcon>
            <FolderIcon className="size-4 text-muted-foreground" />
          </SidebarRowIcon>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{folder.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {itemCountLabel(folder.itemCount)}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell
        className={cn(KNOWLEDGE_COL_CREATOR, "text-sm text-foreground")}
      >
        {folder.creatorName ?? "—"}
      </TableCell>
      <TableCell className={cn(KNOWLEDGE_COL_DATE, "text-sm text-foreground")}>
        {formatDateTimeTr(folder.updated_at)}
      </TableCell>
      <TableCell
        className={KNOWLEDGE_COL_MENU}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <RowMenu
            variant="folder"
            onRename={onRename}
            onDelete={onDelete}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

/** Loading placeholder shown while a content search is in flight. Mirrors the
 * real table layout so the swap to results doesn't shift the page. */
function KnowledgeTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/20 [&_tbody_[data-slot=table-row]]:border-0 [&_tbody_td]:py-3!">
      <Table className={KNOWLEDGE_TABLE_CLASS}>
        <KnowledgeColgroup />
        <TableHeader>
          <TableRow className={KNOWLEDGE_HEADER_ROW_CLASS}>
            <TableHead className={KNOWLEDGE_COL_CHECK}>
              <Skeleton className="size-4 rounded-sm" />
            </TableHead>
            <TableHead className={KNOWLEDGE_COL_NAME}>Ad</TableHead>
            <TableHead className={KNOWLEDGE_COL_CREATOR}>Oluşturan</TableHead>
            <TableHead className={KNOWLEDGE_COL_DATE}>Son güncelleme</TableHead>
            <TableHead className={KNOWLEDGE_COL_MENU} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className={KNOWLEDGE_COL_CHECK}>
                <Skeleton className="size-4 rounded-sm" />
              </TableCell>
              <TableCell className={KNOWLEDGE_COL_NAME}>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-3/4 max-w-full" />
                    <Skeleton className="h-3.5 w-full max-w-full" />
                  </div>
                </div>
              </TableCell>
              <TableCell className={KNOWLEDGE_COL_CREATOR}>
                <Skeleton className="h-3.5 w-24" />
              </TableCell>
              <TableCell className={KNOWLEDGE_COL_DATE}>
                <Skeleton className="h-3.5 w-32" />
              </TableCell>
              <TableCell className={KNOWLEDGE_COL_MENU}>
                <div className="flex justify-end">
                  <Skeleton className="size-7 rounded-xl" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Render `text`, bolding every case-insensitive occurrence of `query`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const re = new RegExp(escapeRegExp(q), "giu")
  const parts: ReactNode[] = []
  let last = 0
  let key = 0
  for (const match of text.matchAll(re)) {
    const found = match.index ?? 0
    if (found > last) parts.push(text.slice(last, found))
    parts.push(
      <strong key={key++} className="font-semibold text-foreground">
        {match[0]}
      </strong>
    )
    last = found + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? <>{parts}</> : <>{text}</>
}

function SourceRowItem({
  source,
  snippet,
  query,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  source: SourceRow
  snippet?: string
  query?: string
  selected: boolean
  onToggle: (on: boolean) => void
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <TableRow className={KNOWLEDGE_ROW_CLASS} onClick={onOpen}>
      <TableCell
        className={KNOWLEDGE_COL_CHECK}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggle(Boolean(v))}
          aria-label="Satırı seç"
          className="size-5"
        />
      </TableCell>
      <TableCell className={KNOWLEDGE_COL_NAME}>
        <div className="flex min-w-0 items-center gap-2.5">
          <SidebarRowIcon>
            <SourceGlyph
              kind={source.kind}
              ext={source.file_ext}
              className="size-4 text-muted-foreground"
            />
          </SidebarRowIcon>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{source.title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {snippet ? (
                <HighlightedText text={snippet} query={query ?? ""} />
              ) : (
                <>
                  {kindLabel(source.kind, source.file_ext)}
                  {source.size_bytes
                    ? ` · ${formatBytes(source.size_bytes)}`
                    : ""}
                </>
              )}
            </p>
          </div>
          <div className="shrink-0">
            <StatusBadge status={source.status} />
          </div>
        </div>
      </TableCell>
      <TableCell
        className={cn(KNOWLEDGE_COL_CREATOR, "text-sm text-foreground")}
      >
        {source.creatorName ?? "—"}
      </TableCell>
      <TableCell className={cn(KNOWLEDGE_COL_DATE, "text-sm text-foreground")}>
        {formatDateTimeTr(source.updated_at)}
      </TableCell>
      <TableCell
        className={KNOWLEDGE_COL_MENU}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <RowMenu variant="source" onDetails={onOpen} onDelete={onDelete} />
        </div>
      </TableCell>
    </TableRow>
  )
}

function RowMenu({
  variant,
  onDetails,
  onRename,
  onDelete,
}: {
  variant: "source" | "folder"
  onDetails?: () => void
  onRename?: () => void
  onDelete: () => void
}) {
  const deleteLabel = variant === "folder" ? "Klasörü sil" : "Dosyayı sil"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="İşlemler"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onDetails && (
          <DropdownMenuItem onClick={onDetails}>
            <PanelRight className="size-4" />
            Detaylar
          </DropdownMenuItem>
        )}
        {onRename && (
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="size-4" />
            Yeniden adlandır
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="size-4" />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

