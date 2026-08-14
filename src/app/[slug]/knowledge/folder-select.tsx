"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { KNOWLEDGE_LIBRARY_LABEL } from "@/lib/knowledge/constants"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import { folderPath } from "./knowledge-meta"

const ROOT = "__root__"

/** Parent-folder picker shared by every Add/Create dialog. */
export function FolderSelect({
  folders,
  value,
  onChange,
  label = "Klasör",
  id = "parent-folder",
  rootLabel = KNOWLEDGE_LIBRARY_LABEL,
}: {
  folders: FolderOption[]
  value: string | null
  onChange: (folderId: string | null) => void
  label?: string
  id?: string
  rootLabel?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ROOT}
        onValueChange={(v) => onChange(v === ROOT ? null : v)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ROOT}>{rootLabel} (kök)</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {folderPath(folders, f.id, rootLabel)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
