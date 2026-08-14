"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { FolderPlus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import { FolderSelect } from "./folder-select"
import { ActionCard } from "./action-card"
import { createFolder } from "./actions"

export function CreateFolderDialog({
  slug,
  organizationId,
  defaultFolderId,
  folders,
  onDone,
  category = "reference",
  triggerLabel = "Klasör Oluştur",
  title = "Klasör Oluştur",
  description = "Kaynakları düzenlemek için klasör ekle. Klasörler iç içe olabilir.",
  nameLabel = "Klasör adı",
  parentLabel = "Üst klasör",
  successLabel = "Klasör oluşturuldu",
  placeholder = "Politikalar",
}: {
  slug: string
  organizationId: string
  defaultFolderId: string | null
  folders: FolderOption[]
  onDone: () => void
  category?: "reference" | "media"
  triggerLabel?: string
  title?: string
  description?: string
  nameLabel?: string
  parentLabel?: string
  successLabel?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string | null>(defaultFolderId)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await createFolder({
        organizationId,
        slug,
        name,
        parentId,
        category,
      })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      toast.success(successLabel)
      setName("")
      setOpen(false)
      onDone()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setParentId(defaultFolderId)
      }}
    >
      <DialogTrigger asChild>
        <ActionCard icon={FolderPlus} label={triggerLabel} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <FolderSelect
            folders={folders}
            value={parentId}
            onChange={setParentId}
            label={parentLabel}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">{nameLabel}</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) submit()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending && <Spinner />} Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
