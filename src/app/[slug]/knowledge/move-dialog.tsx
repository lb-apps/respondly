"use client"

import { useState, useTransition } from "react"
import { Move } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import { FolderTree } from "./folder-tree"
import { moveItems } from "./actions"

export function MoveDialog({
  open,
  onOpenChange,
  slug,
  organizationId,
  folders,
  folderIds,
  sourceIds,
  onDone,
  rootLabel,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  slug: string
  organizationId: string
  folders: FolderOption[]
  folderIds: string[]
  sourceIds: string[]
  onDone: () => void
  rootLabel?: string
}) {
  // `undefined` = nothing picked yet (disables Move); `null` = library root.
  const [target, setTarget] = useState<string | null | undefined>(undefined)
  const [pending, startTransition] = useTransition()

  // Reset the destination when the dialog closes so the next open starts fresh.
  function handleOpenChange(o: boolean) {
    if (!o) setTarget(undefined)
    onOpenChange(o)
  }

  const count = folderIds.length + sourceIds.length

  function submit() {
    if (target === undefined) return
    startTransition(async () => {
      const res = await moveItems({
        organizationId,
        slug,
        folderIds,
        sourceIds,
        targetFolderId: target,
      })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      toast.success("Taşındı")
      handleOpenChange(false)
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-input bg-input/50">
              <Move className="size-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <DialogTitle>
                {count > 1
                  ? `${count} öğe nereye taşınsın?`
                  : "Öğe nereye taşınsın?"}
              </DialogTitle>
              <DialogDescription>Hedef klasörü seç.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <FolderTree
          folders={folders}
          value={target}
          onChange={setTarget}
          disabledIds={folderIds}
          rootLabel={rootLabel}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            İptal
          </Button>
          <Button onClick={submit} disabled={pending || target === undefined}>
            {pending && <Spinner />} Taşı
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
