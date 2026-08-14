"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Images,
  ImageIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Move,
  PanelRight,
  Pencil,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  MEDIA_LIBRARY_DESCRIPTION,
  MEDIA_LIBRARY_LABEL,
  knowledgeImagePublicUrl,
} from "@/lib/knowledge/constants"
import { useRealtimeSync } from "@/hooks/use-realtime-sync"
import { useProcessingPoll } from "@/hooks/use-processing-poll"
import { cn } from "@/lib/utils"
import type {
  FolderOption,
  FolderRow,
  SourceRow,
} from "@/lib/supabase/queries/knowledge"
import { folderTypeIcon, itemCountLabel } from "../knowledge/knowledge-meta"
import { StoragePill } from "../knowledge/storage-pill"
import { FacetFilter } from "../knowledge/facet-filter"
import { SourceDetailSheet } from "../knowledge/source-detail-sheet"
import { MoveDialog } from "../knowledge/move-dialog"
import { RenameFolderDialog } from "../knowledge/rename-folder-dialog"
import { CreateFolderDialog } from "../knowledge/create-folder-dialog"
import { deleteItems, searchSourceContent } from "../knowledge/actions"
import { AddImageDialog } from "./add-image-dialog"

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
      <Badge variant="outline" className="gap-1 bg-background/90">
        <Spinner className="size-3" /> İşleniyor
      </Badge>
    )
  return null
}

const EMPTY_CONTENT_MATCHES = new Map<string, string>()

export function MediaClient({
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [creatorFilter, setCreatorFilter] = useState<Set<string>>(new Set())
  // Server-side content search mirrors Bilgi Kütüphanesi: file names stay
  // client-side, descriptions/chunks are searched in Supabase.
  const [contentMatches, setContentMatches] = useState<Map<string, string>>(
    new Map()
  )
  const [searching, setSearching] = useState(false)
  const [contentSearchQuery, setContentSearchQuery] = useState("")
  const sourceIdsKey = useMemo(
    () => sources.map((s) => s.id).join(","),
    [sources]
  )

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
  const [renameFolder, setRenameFolder] = useState<{
    id: string
    name: string
  } | null>(null)

  // Track the open photo by id so the sheet reflects live status/chunk updates
  // and auto-closes if the row is removed.
  const [detailSourceId, setDetailSourceId] = useState<string | null>(null)
  const detailSource = useMemo(
    () => sources.find((s) => s.id === detailSourceId) ?? null,
    [sources, detailSourceId]
  )

  function clearSelection() {
    setSelectedFolders(new Set())
    setSelectedSources(new Set())
  }

  const refresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  // Background indexing flips status processing→ready/failed. Realtime nudges
  // the moment it lands; the poll guarantees convergence if an event is missed.
  useRealtimeSync({
    channelName: `media-${organizationId}`,
    tables: ["knowledge_sources"],
    filter: `organization_id=eq.${organizationId}`,
    onSync: refresh,
  })

  const hasProcessing = useMemo(
    () => sources.some((s) => s.status === "processing"),
    [sources]
  )
  useProcessingPoll(hasProcessing, refresh)

  function navigateTo(id: string | null) {
    clearSelection()
    router.push(id ? `/${slug}/media?folder=${id}` : `/${slug}/media`)
  }

  // Albums (always above photos), name search, A→Z.
  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = folders
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q))
    if (creatorFilter.size > 0)
      list = list.filter((f) => f.created_by && creatorFilter.has(f.created_by))
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "tr"))
  }, [folders, query, creatorFilter])

  // Photos: creator filter, then title OR Supabase content/description search.
  const visibleSources = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = sources
    if (creatorFilter.size > 0)
      list = list.filter((s) => s.created_by && creatorFilter.has(s.created_by))
    if (q)
      list = list.filter(
        (s) => s.title.toLowerCase().includes(q) || visibleContentMatches.has(s.id)
      )
    return [...list].sort((a, b) => a.title.localeCompare(b.title, "tr"))
  }, [sources, query, creatorFilter, visibleContentMatches])

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
        if (sourceIds.includes(detailSourceId ?? "")) setDetailSourceId(null)
        clearSelection()
        refresh()
      }
    })
  }

  const onDone = () => refresh()
  const isEmpty = totalVisible === 0
  const hasFilters = query.trim() !== "" || creatorFilter.size > 0
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
                <BreadcrumbPage>{MEDIA_LIBRARY_LABEL}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={`/${slug}/media`}>{MEDIA_LIBRARY_LABEL}</Link>
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
                        <Link href={`/${slug}/media?folder=${a.id}`}>
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
                {currentFolderName ?? MEDIA_LIBRARY_LABEL}
              </h1>
              {pending && <Spinner className="size-4 text-muted-foreground" />}
            </div>
            {folderId === null && (
              <p className="max-w-2xl text-base text-muted-foreground">
                {MEDIA_LIBRARY_DESCRIPTION}
              </p>
            )}
          </div>
          <StoragePill
            used={usage.used}
            quota={usage.quota}
            label="Medya depolama"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6">
        {/* Action bar */}
        <div className="flex shrink-0 flex-wrap gap-3">
          <AddImageDialog
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
            category="media"
            triggerLabel="Albüm Oluştur"
            title="Albüm Oluştur"
            description="Görselleri düzenlemek için albüm ekle. Albümler iç içe olabilir."
            nameLabel="Albüm adı"
            parentLabel="Üst albüm"
            successLabel="Albüm oluşturuldu"
            placeholder="Odalar"
          />
        </div>

        {/* Toolbar: search + selection / creator filter */}
        <div className="flex shrink-0 flex-col gap-2.5">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Albüm, görsel adı veya açıklamada ara…"
              className="pr-9 pl-9"
            />
            {searchLoading && (
              <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCount > 0 ? (
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
            )}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => {
                if (v) setViewMode(v as "grid" | "list")
              }}
              variant="outline"
              size="sm"
              spacing={0}
              className="ml-auto"
            >
              <ToggleGroupItem value="grid" aria-label="Izgara görünümü">
                <LayoutGrid className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Liste görünümü">
                <List className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Grid or empty state — fills remaining viewport height */}
        <div className="flex min-h-0 flex-1 flex-col">
        {searchLoading && isEmpty ? (
          <MediaGridSkeleton />
        ) : isEmpty ? (
          <Empty className="min-h-0 flex-1 rounded-xl border border-dashed border-border/70 bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Images />
              </EmptyMedia>
              {folderId === null ? (
                <>
                  <EmptyTitle>
                    {hasFilters ? "Sonuç Bulunamadı" : "Henüz medya yok"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? filteredEmptyDescription
                      : "İlk görselini ekleyerek başla."}
                  </EmptyDescription>
                </>
              ) : (
                <>
                  <EmptyTitle>
                    {hasFilters ? "Sonuç Bulunamadı" : "Albüm boş"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasFilters
                      ? filteredEmptyDescription
                      : "Bu albümde henüz görsel yok."}
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
                  <ArrowLeft className="size-3.5" /> Üst albüme dön
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visibleFolders.map((f) => (
                <AlbumTile
                  key={f.id}
                  folder={f}
                  selected={selectedFolders.has(f.id)}
                  onToggle={(on) => toggleFolder(f.id, on)}
                  onOpen={() => navigateTo(f.id)}
                  onRename={() => setRenameFolder({ id: f.id, name: f.name })}
                  onDelete={() => doDelete([f.id], [])}
                />
              ))}
              {visibleSources.map((s) => (
                <PhotoTile
                  key={s.id}
                  source={s}
                  selected={selectedSources.has(s.id)}
                  onToggle={(on) => toggleSource(s.id, on)}
                  onOpen={() => setDetailSourceId(s.id)}
                  onDelete={() => doDelete([], [s.id])}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {visibleFolders.map((f) => (
                <AlbumRow
                  key={f.id}
                  folder={f}
                  selected={selectedFolders.has(f.id)}
                  onToggle={(on) => toggleFolder(f.id, on)}
                  onOpen={() => navigateTo(f.id)}
                  onRename={() => setRenameFolder({ id: f.id, name: f.name })}
                  onDelete={() => doDelete([f.id], [])}
                />
              ))}
              {visibleSources.map((s) => (
                <PhotoRow
                  key={s.id}
                  source={s}
                  selected={selectedSources.has(s.id)}
                  onToggle={(on) => toggleSource(s.id, on)}
                  onOpen={() => setDetailSourceId(s.id)}
                  onDelete={() => doDelete([], [s.id])}
                />
              ))}
            </div>
          )}
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
        rootLabel={MEDIA_LIBRARY_LABEL}
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
        rootLabel={MEDIA_LIBRARY_LABEL}
        highlightQuery={query.trim()}
      />
    </div>
  )
}

function MediaGridSkeleton({ items = 8 }: { items?: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: items }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border bg-card"
          >
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 border-t px-3 py-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TileCheckbox({
  selected,
  onToggle,
}: {
  selected: boolean
  onToggle: (on: boolean) => void
}) {
  return (
    <div
      className={cn(
        "absolute top-2 left-2 transition-opacity",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onToggle(Boolean(v))}
        aria-label="Seç"
        className="size-5 border-background bg-background/90 shadow-sm"
      />
    </div>
  )
}

function ItemMenu({
  onOpen,
  onRename,
  onDelete,
  openLabel,
  className,
}: {
  onOpen?: () => void
  onRename?: () => void
  onDelete: () => void
  openLabel: string
  className?: string
}) {
  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="size-7 rounded-full bg-background/90 shadow-sm"
            aria-label="İşlemler"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onOpen && (
            <DropdownMenuItem onClick={onOpen}>
              <PanelRight className="size-4" />
              {openLabel}
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
            Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TileMenu(props: {
  onOpen?: () => void
  onRename?: () => void
  onDelete: () => void
  openLabel: string
}) {
  return (
    <ItemMenu
      {...props}
      className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
    />
  )
}

function RowCheckbox({
  selected,
  onToggle,
}: {
  selected: boolean
  onToggle: (on: boolean) => void
}) {
  return (
    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onToggle(Boolean(v))}
        aria-label="Seç"
        className={cn(
          "size-5 transition-opacity",
          selected ? "opacity-100" : "opacity-60 group-hover:opacity-100"
        )}
      />
    </div>
  )
}

function AlbumTile({
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
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card",
        selected && "ring-2 ring-primary"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
        aria-label={`${folder.name} albümünü aç`}
      >
        <FolderIcon className="size-10" />
      </button>
      <TileCheckbox selected={selected} onToggle={onToggle} />
      <TileMenu
        onRename={onRename}
        onDelete={onDelete}
        openLabel="Albümü aç"
      />
      <div className="border-t px-3 py-2">
        <p className="truncate text-sm font-medium" title={folder.name}>
          {folder.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {itemCountLabel(folder.itemCount)}
        </p>
      </div>
    </div>
  )
}

function PhotoTile({
  source,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  source: SourceRow
  selected: boolean
  onToggle: (on: boolean) => void
  onOpen: () => void
  onDelete: () => void
}) {
  const url = source.raw_ref ? knowledgeImagePublicUrl(source.raw_ref) : null
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card",
        selected && "ring-2 ring-primary"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full bg-muted focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
        aria-label={`${source.title} detayları`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={source.title}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
      </button>

      {source.status !== "ready" && (
        <div className="pointer-events-none absolute bottom-12 left-2">
          <StatusBadge status={source.status} />
        </div>
      )}

      <TileCheckbox selected={selected} onToggle={onToggle} />
      <TileMenu onOpen={onOpen} onDelete={onDelete} openLabel="Detaylar" />

      <div className="border-t px-3 py-2">
        <p className="truncate text-sm font-medium" title={source.title}>
          {source.title}
        </p>
        {source.content?.trim() && (
          <p
            className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
            title={source.content}
          >
            {source.content}
          </p>
        )}
      </div>
    </div>
  )
}

function AlbumRow({
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
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border bg-card px-3 py-2",
        selected && "ring-2 ring-primary"
      )}
    >
      <RowCheckbox selected={selected} onToggle={onToggle} />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
        aria-label={`${folder.name} albümünü aç`}
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground transition-colors group-hover:bg-muted">
          <FolderIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={folder.name}>
            {folder.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {itemCountLabel(folder.itemCount)}
          </p>
        </div>
      </button>
      <ItemMenu
        onRename={onRename}
        onDelete={onDelete}
        openLabel="Albümü aç"
        className="shrink-0"
      />
    </div>
  )
}

function PhotoRow({
  source,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  source: SourceRow
  selected: boolean
  onToggle: (on: boolean) => void
  onOpen: () => void
  onDelete: () => void
}) {
  const url = source.raw_ref ? knowledgeImagePublicUrl(source.raw_ref) : null
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border bg-card px-3 py-2",
        selected && "ring-2 ring-primary"
      )}
    >
      <RowCheckbox selected={selected} onToggle={onToggle} />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
        aria-label={`${source.title} detayları`}
      >
        <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={source.title}
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium" title={source.title}>
              {source.title}
            </p>
            {source.status !== "ready" && <StatusBadge status={source.status} />}
          </div>
          {source.content?.trim() && (
            <p
              className="mt-0.5 truncate text-xs text-muted-foreground"
              title={source.content}
            >
              {source.content}
            </p>
          )}
        </div>
      </button>
      <ItemMenu
        onOpen={onOpen}
        onDelete={onDelete}
        openLabel="Detaylar"
        className="shrink-0"
      />
    </div>
  )
}
