"use client"

import { useEffect, useState, useTransition, type FocusEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { renameItem } from "./actions"

export function RenameFolderDialog({
  open,
  onOpenChange,
  folderId,
  currentName,
  slug,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: string
  currentName: string
  slug: string
  onDone: () => void
}) {
  const [name, setName] = useState(currentName)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setName(currentName)
  }, [open, currentName])

  const trimmed = name.trim()
  const unchanged = trimmed === currentName
  const canSave = trimmed.length > 0 && !unchanged

  function submit() {
    if (!canSave) return
    startTransition(async () => {
      const res = await renameItem({
        id: folderId,
        kind: "folder",
        name: trimmed,
        slug,
      })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      onOpenChange(false)
      onDone()
    })
  }

  function handleInputFocus(e: FocusEvent<HTMLInputElement>) {
    const len = e.currentTarget.value.length
    requestAnimationFrame(() => {
      e.currentTarget.setSelectionRange(len, len)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Yeniden adlandır</DialogTitle>
          <DialogDescription>Klasörün yeni adını girin.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="rename-folder-name">Klasör adı</Label>
          <Input
            id="rename-folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) submit()
            }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !canSave}>
            {pending && <Spinner />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
