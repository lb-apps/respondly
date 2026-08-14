"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import {
  ArrowUpRight,
  Calendar,
  CircleHelp,
  ExternalLink,
  AlignLeft,
  FileText,
  Link2,
  Pencil,
  RefreshCw,
  Scale,
  Upload,
  type LucideIcon,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatDateTimeTr } from "@/lib/format/datetime"
import { KNOWLEDGE_BUCKET, KNOWLEDGE_IMAGE_BUCKET } from "@/lib/knowledge/constants"
import {
  acceptForFileExt,
  fileExtOf,
  KNOWLEDGE_FILE_MAX_BYTES,
  mimeForFileExt,
} from "@/lib/knowledge/file-upload"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { SourceDetail } from "@/lib/supabase/queries/knowledge"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import type { SourceRow } from "@/lib/supabase/queries/knowledge"
import {
  contentSectionTitle,
  formatBytes,
  folderPath,
  kindLabel,
} from "./knowledge-meta"
import { DETAIL_SIDEBAR_STACK_CLASS } from "./link-auto-toggles"
import { LinkSourceSettings } from "./link-source-settings"
import { SidebarRowIcon } from "./sidebar-row-icon"
import {
  loadSourceDetail,
  renameItem,
  reingestSource,
  replaceFileSource,
  updateSourceContent,
} from "./actions"

/** Gap between sheet edge and bordered content panel. */
const CONTENT_PANEL_INSET_CLASS = "p-5 md:p-6"

const CONTENT_PANEL_SHELL_CLASS = "rounded-xl border bg-muted/40"

/** Text inset only — scrollbars sit on the shell edge, not inside this padding. */
const CONTENT_PANEL_TEXT_INSET_CLASS = "p-5 md:p-6"

function ContentPanelArea({
  header,
  children,
}: {
  header: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden",
        CONTENT_PANEL_INSET_CLASS,
      )}
    >
      {header}
      {children}
    </div>
  )
}

function ContentPanelShell({
  children,
  editing = false,
}: {
  children: ReactNode
  editing?: boolean
}) {
  return (
    <div
      className={cn(
        CONTENT_PANEL_SHELL_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        editing ? "border-foreground" : "border-border/70",
      )}
    >
      <ScrollArea className="min-h-0 flex-1 **:data-[slot=scroll-area-scrollbar]:py-2">
        <div className={CONTENT_PANEL_TEXT_INSET_CLASS}>{children}</div>
      </ScrollArea>
    </div>
  )
}

function getScrollAreaViewport(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]") ?? null
}

const CONTENT_PRE_CLASS =
  "whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground"

/**
 * Render content as preformatted text. When `query` is set, every
 * case-insensitive match is wrapped in `<mark>` and the panel auto-scrolls so
 * the first hit lands centered in the bordered ScrollArea viewport.
 */
function HighlightedContent({
  content,
  query,
}: {
  content: string
  query: string
}) {
  const firstMatchRef = useRef<HTMLElement | null>(null)
  const q = query.trim()

  useEffect(() => {
    const el = firstMatchRef.current
    if (!el) return
    const viewport = el.closest<HTMLElement>(
      "[data-slot=scroll-area-viewport]",
    )
    if (!viewport) {
      el.scrollIntoView({ block: "center" })
      return
    }
    const elRect = el.getBoundingClientRect()
    const vpRect = viewport.getBoundingClientRect()
    const top =
      viewport.scrollTop +
      (elRect.top - vpRect.top) -
      viewport.clientHeight / 2 +
      elRect.height / 2
    viewport.scrollTo({ top: Math.max(0, top) })
  }, [q, content])

  if (!q) {
    return <pre className={CONTENT_PRE_CLASS}>{content}</pre>
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = content.split(new RegExp(`(${escaped})`, "iu"))
  const lower = q.toLowerCase()
  const firstMatchIndex = parts.findIndex((p) => p.toLowerCase() === lower)

  return (
    <pre className={CONTENT_PRE_CLASS}>
      {parts.map((part, i) => {
        if (part.toLowerCase() !== lower) return part
        return (
          <mark
            key={i}
            ref={i === firstMatchIndex ? firstMatchRef : undefined}
            className="rounded-[3px] bg-primary/20 px-0.5 text-foreground"
          >
            {part}
          </mark>
        )
      })}
    </pre>
  )
}

function ContentPanelEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-h-full">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-sizing-content min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-0 font-sans text-sm leading-relaxed shadow-none focus-visible:ring-0"
      />
    </div>
  )
}

const RAG_STATUS_LABEL_HINT =
  "Kaynak metni parçalara bölünür; asistan müşteri mesajlarında bunları kullanır. Parça sayısı, kaynağın kaç bölüm halinde hazır olduğunu gösterir."

function MetaField({
  icon,
  label,
  children,
  action,
  labelHint,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
  action?: ReactNode
  /** Short explanation shown in a tooltip on the label row. */
  labelHint?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <SidebarRowIcon icon={icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-sm font-medium leading-snug text-foreground">
              {label}
            </span>
            {labelHint ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${label} hakkında bilgi`}
                    >
                      <CircleHelp className="size-3.5" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-68 px-3 py-2 text-xs leading-relaxed"
                  >
                    {labelHint}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
        <div className="min-w-0 text-sm leading-snug text-muted-foreground wrap-break-word">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * RAG status from the LIVE row status (kept fresh by the list's realtime/poll),
 * with the chunk count from the separately-fetched detail. Reading status off
 * the live row — not the detail snapshot — keeps the sheet and the table badge
 * in lockstep (single source of truth).
 */
function metaRagLabel(status: string, chunkCount: number): ReactNode {
  if (status === "processing")
    return (
      <span className="inline-flex items-center gap-1.5">
        <Spinner className="size-3.5" />
        İşleniyor
      </span>
    )
  if (status === "ready" && chunkCount > 0) return `${chunkCount} parça`
  if (status === "failed") return "Başarısız"
  return "İndekslenmedi"
}

function sourceKindIcon(kind: SourceRow["kind"]) {
  if (kind === "link") return Link2
  if (kind === "text") return AlignLeft
  return FileText
}

const SOURCE_TITLE_TEXT_CLASS =
  "whitespace-pre px-0 text-lg font-medium leading-tight md:text-lg"

const SOURCE_TITLE_INPUT_CLASS = cn(
  SOURCE_TITLE_TEXT_CLASS,
  "absolute inset-0 size-full min-w-0 flex-none overflow-x-auto border-0 bg-transparent py-0 shadow-none",
  "h-auto text-left focus-visible:ring-0 md:text-lg",
)

/** Title field sized to its text; highlight layer wider via InputGroup ::before. */
function SourceTitleInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <InputGroup
      className={cn(
        "relative inline-flex h-auto w-fit max-w-full min-w-0 self-start border-0 bg-transparent px-0 shadow-none",
        "rounded-xl before:pointer-events-none before:absolute before:-inset-x-2 before:-inset-y-1 before:-z-10 before:rounded-xl before:content-[''] before:transition-colors",
        "hover:before:bg-muted",
        "has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0",
        "has-[[data-slot=input-group-control]:focus-visible]:before:bg-muted",
      )}
    >
      <div className="relative inline-block max-w-full min-w-[2ch] overflow-hidden">
        <span className={cn(SOURCE_TITLE_TEXT_CLASS, "invisible block")} aria-hidden>
          {value || "\u00a0"}
        </span>
        <InputGroupInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={SOURCE_TITLE_INPUT_CLASS}
          aria-label="Kaynak adı"
        />
      </div>
    </InputGroup>
  )
}

export function SourceDetailSheet({
  source,
  open,
  onOpenChange,
  slug,
  folders,
  onChanged,
  highlightQuery,
  rootLabel,
}: {
  source: SourceRow | null
  open: boolean
  onOpenChange: (o: boolean) => void
  slug: string
  folders: FolderOption[]
  onChanged: () => void
  /** Search term to highlight + scroll to inside the content area. */
  highlightQuery?: string
  /** Root crumb label when the source sits at the root (defaults to the KB label). */
  rootLabel?: string
}) {
  const [hasUnsavedContent, setHasUnsavedContent] = useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (!next && hasUnsavedContent) {
        setDiscardDialogOpen(true)
        return
      }
      onOpenChange(next)
    },
    [hasUnsavedContent, onOpenChange],
  )

  function discardChangesAndClose() {
    setDiscardDialogOpen(false)
    setHasUnsavedContent(false)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {source && (
            <DetailBody
              key={source.id}
              source={source}
              slug={slug}
              folders={folders}
              onChanged={onChanged}
              onUnsavedContentChange={setHasUnsavedContent}
              highlightQuery={highlightQuery}
              rootLabel={rootLabel}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaydedilmemiş değişiklikler var.</AlertDialogTitle>
            <AlertDialogDescription>
              Bu değişiklikleri kaydetmeden çıkmak istediğinizden emin
              misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={discardChangesAndClose}
            >
              Çık
            </AlertDialogAction>
            <AlertDialogCancel>Düzenlemeye devam et</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Sheet body — mounted per source via `key={source.id}`, so all local state
 * (title draft, edit mode, loaded detail) initializes cleanly from props on
 * each open without synchronous resets.
 */
function DetailBody({
  source,
  slug,
  folders,
  onChanged,
  onUnsavedContentChange,
  highlightQuery,
  rootLabel,
}: {
  source: SourceRow
  slug: string
  folders: FolderOption[]
  onChanged: () => void
  onUnsavedContentChange: (hasUnsaved: boolean) => void
  highlightQuery?: string
  rootLabel?: string
}) {
  const [detail, setDetail] = useState<SourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState(source.title)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentPanelRef = useRef<HTMLDivElement>(null)
  const pendingContentScrollTopRef = useRef<number | null>(null)
  const isFileSource = source.kind === "file"
  const isImageSource = source.kind === "image"

  // Re-fetch detail (chunk count, RAG status, content) when the row changes —
  // including `updated_at` bumps from background indexing finishing — so the
  // open sheet live-updates. Don't overwrite an in-progress edit draft.
  const editingRef = useRef(editing)
  useEffect(() => {
    editingRef.current = editing
  }, [editing])

  useEffect(() => {
    let active = true
    loadSourceDetail(source.id).then((d) => {
      if (!active) return
      setDetail(d)
      if (!editingRef.current) setDraft(d?.content ?? "")
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [source.id, source.updated_at])

  function saveTitle() {
    if (title.trim() === source.title || !title.trim()) return
    startTransition(async () => {
      const res = await renameItem({
        id: source.id,
        kind: "source",
        name: title.trim(),
        slug,
      })
      if (!res.ok) toast.error("Hata", { description: res.error })
      else onChanged()
    })
  }

  function saveContent() {
    startTransition(async () => {
      const res = await updateSourceContent({
        sourceId: source.id,
        slug,
        content: draft,
      })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      toast.success("İçerik kaydedildi, arka planda yeniden indeksleniyor")
      setEditing(false)
      const fresh = await loadSourceDetail(source.id)
      setDetail(fresh)
      onChanged()
    })
  }

  function refresh() {
    startTransition(async () => {
      const res = await reingestSource(source.id, slug)
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      toast.success("Kaynak arka planda yeniden indeksleniyor")
      const fresh = await loadSourceDetail(source.id)
      setDetail(fresh)
      onChanged()
    })
  }

  function onUpdateClick() {
    if (isFileSource) {
      fileInputRef.current?.click()
      return
    }
    refresh()
  }

  async function onReplaceFileSelected(file: File) {
    const expectedExt = (source.file_ext ?? "").toLowerCase()
    const ext = fileExtOf(file.name)
    if (!expectedExt || ext !== expectedExt) {
      toast.error(`Aynı türde dosya seçin (.${expectedExt || "dosya"})`)
      return
    }
    if (file.size > KNOWLEDGE_FILE_MAX_BYTES) {
      toast.error("Dosya 21 MB sınırını aşıyor")
      return
    }
    const storagePath = source.raw_ref
    if (!storagePath) {
      toast.error("Dosya yolu bulunamadı")
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const mime = mimeForFileExt(ext, file.type)
      const { error: upErr } = await supabase.storage
        .from(KNOWLEDGE_BUCKET)
        .upload(storagePath, file, { contentType: mime, upsert: true })
      if (upErr) {
        toast.error("Yükleme başarısız", { description: upErr.message })
        return
      }

      const res = await replaceFileSource({
        sourceId: source.id,
        slug,
        storagePath,
        fileExt: ext,
        mimeType: mime,
        sizeBytes: file.size,
      })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      toast.success("Dosya kaydedildi, arka planda yeniden indeksleniyor")
      const fresh = await loadSourceDetail(source.id)
      setDetail(fresh)
      onChanged()
    })
  }

  function cancelEdit() {
    setDraft(detail?.content ?? "")
    setEditing(false)
  }

  function startContentEdit() {
    const viewport = getScrollAreaViewport(contentPanelRef.current)
    if (viewport) pendingContentScrollTopRef.current = viewport.scrollTop
    setEditing(true)
  }

  useLayoutEffect(() => {
    if (!editing) return
    const top = pendingContentScrollTopRef.current
    if (top == null) return
    const viewport = getScrollAreaViewport(contentPanelRef.current)
    if (!viewport) return
    viewport.scrollTop = top
    pendingContentScrollTopRef.current = null
  }, [editing])

  const savedContent = detail?.content ?? ""
  const hasContentChanges = editing && draft !== savedContent
  // Drive processing UI from the live row status (source prop), not the detail
  // snapshot — so the sheet flips with the table the instant the list refreshes.
  const isProcessing = source.status === "processing"

  useEffect(() => {
    onUnsavedContentChange(hasContentChanges)
    return () => onUnsavedContentChange(false)
  }, [hasContentChanges, onUnsavedContentChange])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SheetHeader className="shrink-0 items-start gap-1 border-b p-0 px-4 py-4 text-left">
        <p className="w-full text-sm leading-none text-muted-foreground">
          {folderPath(folders, source.folder_id, rootLabel)}
        </p>
        <SheetTitle className="sr-only">{source.title}</SheetTitle>
        <SourceTitleInput
          value={title}
          onChange={setTitle}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
        />
      </SheetHeader>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        {/* Left: metadata */}
        <div className="overflow-y-auto border-b px-5 py-8 md:border-b-0 md:border-r">
          {loading || !detail ? (
            <div className={DETAIL_SIDEBAR_STACK_CLASS}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={DETAIL_SIDEBAR_STACK_CLASS}>
              <MetaField icon={Calendar} label="Oluşturulma">
                {formatDateTimeTr(source.created_at)}
              </MetaField>
              <MetaField icon={Pencil} label="Son güncelleme">
                {formatDateTimeTr(source.updated_at)}
              </MetaField>
              <MetaField icon={User} label="Oluşturan">
                {source.creatorName ?? "—"}
              </MetaField>
              <MetaField icon={Scale} label="Boyut">
                {formatBytes(source.size_bytes)}
              </MetaField>
              <MetaField
                icon={ArrowUpRight}
                label="RAG durumu"
                labelHint={RAG_STATUS_LABEL_HINT}
              >
                {metaRagLabel(source.status, detail.chunkCount)}
              </MetaField>
              <MetaField icon={sourceKindIcon(source.kind)} label="Kaynak türü">
                <span className="inline-flex items-center gap-1">
                  {kindLabel(source.kind, source.file_ext)}
                  {source.kind === "link" && source.raw_ref && (
                    <a
                      href={source.raw_ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-foreground hover:text-primary"
                      aria-label="Bağlantıyı aç"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </span>
              </MetaField>
              {source.kind === "link" && (
                <LinkSourceSettings
                  sourceId={source.id}
                  slug={slug}
                  autoRefresh={source.auto_refresh}
                  autoRemove={source.auto_remove}
                  lastRefreshedAt={source.last_refreshed_at}
                  onUpdated={onChanged}
                />
              )}
            </div>
          )}
        </div>

        {/* Right: content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <ContentPanelArea
            header={
              <div className="flex shrink-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <AlignLeft
                    className="size-4 shrink-0 text-foreground"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <h3 className="truncate text-sm font-medium text-foreground">
                    {contentSectionTitle(source.kind)}
                  </h3>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 **:data-[slot=button]:transition-none">
                  {isFileSource ? (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={acceptForFileExt(source.file_ext)}
                      className="hidden"
                      aria-hidden
                      tabIndex={-1}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ""
                        if (file) void onReplaceFileSelected(file)
                      }}
                    />
                  ) : null}
                  {!editing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onUpdateClick}
                        disabled={pending || isProcessing}
                        className="gap-1.5"
                      >
                        {isFileSource ? (
                          <Upload className="size-3.5" aria-hidden />
                        ) : (
                          <RefreshCw className="size-3.5" aria-hidden />
                        )}
                        Güncelle
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startContentEdit}
                        disabled={isProcessing}
                        className="gap-1.5"
                      >
                        <Pencil className="size-3.5" />
                        Düzenle
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={pending}
                      >
                        Vazgeç
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveContent}
                        disabled={pending || !hasContentChanges}
                      >
                        {pending && <Spinner />} Kaydet
                      </Button>
                    </>
                  )}
                </div>
              </div>
            }
          >
            <div ref={contentPanelRef} className="flex min-h-0 flex-1 flex-col">
              {isImageSource && source.raw_ref && !editing && (
                <div className="mb-3 shrink-0 overflow-hidden rounded-2xl border">
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${KNOWLEDGE_IMAGE_BUCKET}/${source.raw_ref}`}
                    alt={source.title}
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              )}
              <ContentPanelShell editing={editing}>
                {loading || (isProcessing && !editing) ? (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : editing ? (
                  <ContentPanelEditor value={draft} onChange={setDraft} />
                ) : (
                  <HighlightedContent
                    content={detail?.content || "İçerik yok."}
                    query={detail?.content ? highlightQuery ?? "" : ""}
                  />
                )}
              </ContentPanelShell>
            </div>
          </ContentPanelArea>
        </div>
      </div>
    </div>
  )
}
