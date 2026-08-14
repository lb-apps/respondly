"use client"

import { useMemo, useState } from "react"
import { Check, ChevronRight, Folder, Library, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { KNOWLEDGE_LIBRARY_LABEL } from "@/lib/knowledge/constants"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import { folderPath } from "./knowledge-meta"

/**
 * Destination picker for the Move dialog: an expandable folder tree with a
 * search filter. The library root (`null`) sits at the top. Folders being
 * moved — and their descendants — are disabled so a folder can't land inside
 * itself (the server guards this too). `value === undefined` means nothing
 * picked yet; `null` means the root.
 */
export function FolderTree({
  folders,
  value,
  onChange,
  disabledIds = [],
  rootLabel = KNOWLEDGE_LIBRARY_LABEL,
}: {
  folders: FolderOption[]
  value: string | null | undefined
  onChange: (id: string | null) => void
  disabledIds?: string[]
  rootLabel?: string
}) {
  const [query, setQuery] = useState("")

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, FolderOption[]>()
    for (const f of folders) {
      const key = f.parent_id ?? null
      const arr = map.get(key) ?? []
      arr.push(f)
      map.set(key, arr)
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.name.localeCompare(b.name, "tr"))
    return map
  }, [folders])

  // A moved folder and everything beneath it can't be a destination.
  const blocked = useMemo(() => {
    const set = new Set<string>()
    const walk = (id: string) => {
      set.add(id)
      for (const c of childrenOf.get(id) ?? []) walk(c.id)
    }
    for (const id of disabledIds) walk(id)
    return set
  }, [disabledIds, childrenOf])

  // Default: expand every folder that has children so the tree is fully visible.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const parents = new Set<string>()
    for (const f of folders) if (f.parent_id) parents.add(f.parent_id)
    return parents
  })

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return null
    return folders
      .filter((f) => f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
  }, [folders, q])

  function renderNode(folder: FolderOption, depth: number) {
    const kids = childrenOf.get(folder.id) ?? []
    const isExpanded = expanded.has(folder.id)
    const isDisabled = blocked.has(folder.id)
    const isSelected = value === folder.id

    return (
      <div key={folder.id}>
        <div
          className="flex items-center"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          {kids.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(folder.id)}
              aria-label={isExpanded ? "Daralt" : "Genişlet"}
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          ) : (
            <span className="size-6 shrink-0" />
          )}
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => onChange(folder.id)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
              isSelected
                ? "bg-muted font-medium"
                : "hover:bg-muted/60",
              isDisabled && "pointer-events-none opacity-40"
            )}
          >
            <Folder className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{folder.name}</span>
            {isSelected && <Check className="ml-auto size-4 shrink-0" />}
          </button>
        </div>
        {isExpanded && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Klasör ara…"
          className="h-10 pl-9"
        />
      </div>

      <div className="max-h-72 min-h-32 overflow-y-auto pr-1">
        {matches ? (
          matches.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Eşleşen klasör yok
            </p>
          ) : (
            matches.map((f) => {
              const isDisabled = blocked.has(f.id)
              const isSelected = value === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onChange(f.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                    isSelected ? "bg-muted font-medium" : "hover:bg-muted/60",
                    isDisabled && "pointer-events-none opacity-40"
                  )}
                >
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {f.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {folderPath(folders, f.parent_id)}
                    </span>
                  </span>
                  {isSelected && <Check className="size-4 shrink-0" />}
                </button>
              )
            })
          )
        ) : (
          <>
            <div className="flex items-center">
              <span className="size-6 shrink-0" />
              <button
                type="button"
                onClick={() => onChange(null)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                  value === null ? "bg-muted font-medium" : "hover:bg-muted/60"
                )}
              >
                <Library className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{rootLabel}</span>
                {value === null && <Check className="ml-auto size-4 shrink-0" />}
              </button>
            </div>
            {(childrenOf.get(null) ?? []).map((f) => renderNode(f, 0))}
          </>
        )}
      </div>
    </div>
  )
}
