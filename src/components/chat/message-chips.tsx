"use client"

import {
  AlignLeft,
  BookOpen,
  FileText,
  GalleryHorizontal,
  Globe,
  ImageIcon,
  Link2,
  MapPin,
  MessageSquareReply,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * The audit row under an assistant message: which knowledge sources it leaned
 * on, which tools it called, and where its sources contradicted each other.
 *
 * Lives apart from `chat-message-bubble.tsx` because two very different bubbles
 * render it — the preview's and the inbox's. Sharing the component rather than
 * the markup is what keeps the two surfaces from drifting: there is one set of
 * extractors, one set of Turkish labels, one definition of what counts as a tool.
 *
 * Everything here reads the `parts[]` shape the assistant produces. The preview
 * passes the full parts of a live turn; the inbox passes `messages.tool_trace`,
 * which is the same shape projected down to these fields (see
 * `@/lib/assistant/tool-trace`).
 */

const SOURCE_KIND_ICON: Record<string, React.ElementType> = {
  file: FileText,
  link: Globe,
  text: AlignLeft,
  image: ImageIcon,
}

/** Tools surfaced by their own chip, so they do not also count as "araç". */
const TOOLS_CHIP_EXCLUDED = new Set(["search_knowledge", "flag_source_conflict"])

const TOOL_META: Record<string, { label: string; Icon: LucideIcon }> = {
  send_link_button: {
    label: "Bağlantı butonu",
    Icon: Link2,
  },
  ask_choice: {
    label: "Seçenekli soru",
    Icon: MessageSquareReply,
  },
  show_carousel: {
    label: "Kart galerisi",
    Icon: GalleryHorizontal,
  },
  request_location: {
    label: "Konum isteği",
    Icon: MapPin,
  },
}

function humanizeToolName(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Both the AI SDK's native `tool-<name>` parts and our `dynamic-tool` ones. */
export function toolNameFromPart(rec: Record<string, unknown>): string {
  const type = typeof rec.type === "string" ? rec.type : ""
  if (type === "dynamic-tool") {
    return typeof rec.toolName === "string" ? rec.toolName : ""
  }
  if (type.startsWith("tool-")) {
    return type.slice("tool-".length)
  }
  return ""
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null
}

export type UsedSource = { id: string; name: string; kind: string }

export function extractUsedSources(parts: unknown[]): UsedSource[] {
  const seen = new Map<string, { name: string; kind: string }>()
  for (const part of parts) {
    const rec = asRecord(part)
    if (!rec) continue
    if (toolNameFromPart(rec) !== "search_knowledge") continue
    const result = asRecord(rec.output ?? rec.result)
    if (!result) continue
    const passages = Array.isArray(result.passages) ? result.passages : []
    for (const p of passages) {
      const pr = asRecord(p)
      if (!pr) continue
      const id = typeof pr.sourceId === "string" ? pr.sourceId : null
      const name = typeof pr.sourceName === "string" ? pr.sourceName : null
      const kind = typeof pr.sourceKind === "string" ? pr.sourceKind : "text"
      if (id && name && !seen.has(id)) seen.set(id, { name, kind })
    }
  }
  return Array.from(seen, ([id, { name, kind }]) => ({ id, name, kind }))
}

export type UsedTool = { name: string; label: string; Icon: LucideIcon }

export function extractUsedTools(parts: unknown[]): UsedTool[] {
  const seen = new Set<string>()
  const tools: UsedTool[] = []

  for (const part of parts) {
    const rec = asRecord(part)
    if (!rec) continue
    const toolName = toolNameFromPart(rec)
    if (!toolName || TOOLS_CHIP_EXCLUDED.has(toolName) || seen.has(toolName)) continue

    seen.add(toolName)
    const meta = TOOL_META[toolName]
    tools.push({
      name: toolName,
      label: meta?.label ?? humanizeToolName(toolName),
      Icon: meta?.Icon ?? Wrench,
    })
  }

  return tools
}

function buildSourceMap(parts: unknown[]): Map<string, { name: string; kind: string }> {
  const map = new Map<string, { name: string; kind: string }>()
  for (const s of extractUsedSources(parts)) {
    map.set(s.id, { name: s.name, kind: s.kind })
  }
  return map
}

export type SourceConflictGroup = {
  topic: string
  sources: Array<{
    sourceId: string
    value: string
    quote: string
    name: string
    kind: string
  }>
}

export function extractSourceConflicts(
  parts: unknown[],
  sourceMap: Map<string, { name: string; kind: string }>
): SourceConflictGroup[] {
  const groups: SourceConflictGroup[] = []

  for (const part of parts) {
    const rec = asRecord(part)
    if (!rec) continue
    if (toolNameFromPart(rec) !== "flag_source_conflict") continue

    const result = asRecord(rec.output ?? rec.result)
    const args = asRecord(rec.input ?? rec.args)
    // The tool echoes the payload back when it recorded one; otherwise the
    // arguments are the only place the conflict exists.
    const payload = result?.recorded === true ? result : args
    if (!payload) continue

    const topic = typeof payload.topic === "string" ? payload.topic.trim() : ""
    const rawConflicts = Array.isArray(payload.conflicts) ? payload.conflicts : []
    const sources: SourceConflictGroup["sources"] = []

    for (const item of rawConflicts) {
      const row = asRecord(item)
      if (!row) continue
      const sourceId = typeof row.sourceId === "string" ? row.sourceId : null
      const value = typeof row.value === "string" ? row.value.trim() : ""
      const quote = typeof row.quote === "string" ? row.quote.trim() : ""
      if (!sourceId) continue
      const meta = sourceMap.get(sourceId)
      sources.push({
        sourceId,
        value,
        quote,
        name: meta?.name ?? "Kaynak",
        kind: meta?.kind ?? "text",
      })
    }

    // One source disagreeing with nothing is not a conflict.
    if (topic && sources.length >= 2) {
      groups.push({ topic, sources })
    }
  }

  return groups
}

const CHIP_CLASS =
  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"

function SourcesChip({
  sources,
  onSourceClick,
}: {
  sources: UsedSource[]
  onSourceClick: (id: string) => void
}) {
  if (sources.length === 0) return null

  const label =
    sources.length === 1
      ? "1 kaynak kullanıldı"
      : `${sources.length} kaynak kullanıldı`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            CHIP_CLASS,
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <BookOpen className="size-3 shrink-0" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-1">
        <ul className="flex flex-col">
          {sources.map((s) => {
            const Icon = SOURCE_KIND_ICON[s.kind] ?? FileText
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSourceClick(s.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="truncate">{s.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function ToolsChip({ tools }: { tools: UsedTool[] }) {
  if (tools.length === 0) return null

  const label =
    tools.length === 1 ? "1 araç kullanıldı" : `${tools.length} araç kullanıldı`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            CHIP_CLASS,
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <Wrench className="size-3 shrink-0" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-1">
        <ul className="flex flex-col">
          {tools.map((t) => (
            <li
              key={t.name}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground"
            >
              <t.Icon className="size-3 shrink-0" />
              <span className="truncate">{t.label}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function ConflictsChip({
  groups,
  onConflictSourceClick,
}: {
  groups: SourceConflictGroup[]
  onConflictSourceClick: (sourceId: string, highlight: string) => void
}) {
  if (groups.length === 0) return null

  const sourceCount = groups.reduce((n, g) => n + g.sources.length, 0)
  const label =
    groups.length === 1
      ? `Tutarsızlık: ${sourceCount}`
      : `Tutarsızlık (${groups.length})`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            CHIP_CLASS,
            "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
          )}
        >
          <TriangleAlert className="size-3 shrink-0" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-1">
        <div className="flex flex-col gap-2 p-1">
          {groups.map((group) => (
            <div key={group.topic} className="flex flex-col gap-0.5">
              <p className="text-muted-foreground px-2 text-xs font-semibold tracking-wide uppercase">
                {group.topic}
              </p>
              <ul className="flex flex-col">
                {group.sources.map((s) => {
                  const Icon = SOURCE_KIND_ICON[s.kind] ?? FileText
                  const highlight = s.quote.trim() || s.value.trim()
                  return (
                    <li key={`${group.topic}-${s.sourceId}-${s.value}`}>
                      <button
                        type="button"
                        onClick={() => onConflictSourceClick(s.sourceId, highlight)}
                        className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                      >
                        <Icon className="text-muted-foreground mt-0.5 size-3 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.name}</span>
                          <span className="text-muted-foreground line-clamp-2">{s.value}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Renders nothing when the turn used no sources and called no tools, so a
 * plain answer keeps a plain bubble. The Kaynaklar and Tutarsızlık chips also
 * need somewhere to send a click: without a handler they stay hidden rather
 * than rendering a button that does nothing.
 */
export function MessageChips({
  parts,
  onSourceClick,
  onConflictSourceClick,
}: {
  parts: unknown[]
  onSourceClick?: (id: string) => void
  onConflictSourceClick?: (sourceId: string, highlight: string) => void
}) {
  if (parts.length === 0) return null

  const usedSources = extractUsedSources(parts)
  const usedTools = extractUsedTools(parts)
  const conflictGroups = extractSourceConflicts(parts, buildSourceMap(parts))

  if (
    usedSources.length === 0 &&
    usedTools.length === 0 &&
    conflictGroups.length === 0
  ) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {usedSources.length > 0 && onSourceClick && (
        <SourcesChip sources={usedSources} onSourceClick={onSourceClick} />
      )}
      {usedTools.length > 0 && <ToolsChip tools={usedTools} />}
      {conflictGroups.length > 0 && onConflictSourceClick && (
        <ConflictsChip
          groups={conflictGroups}
          onConflictSourceClick={onConflictSourceClick}
        />
      )}
    </div>
  )
}
