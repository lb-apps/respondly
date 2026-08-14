"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { createTextSource } from "./actions"

export function CreateTextDialog({
  slug,
  organizationId,
  assistantId,
  defaultFolderId,
  folders,
  onDone,
}: {
  slug: string
  organizationId: string
  assistantId: string | null
  defaultFolderId: string | null
  folders: FolderOption[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await createTextSource({
        organizationId,
        assistantId,
        slug,
        folderId,
        title,
        content,
      })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      toast.success("Metin eklendi")
      setTitle("")
      setContent("")
      setOpen(false)
      onDone()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setFolderId(defaultFolderId)
      }}
    >
      <DialogTrigger asChild>
        <ActionCard icon={Type} label="Metin Oluştur" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Metin Oluştur</DialogTitle>
          <DialogDescription>
            Asistanın temel alacağı serbest metin ekle.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <FolderSelect folders={folders} value={folderId} onChange={setFolderId} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="text-name">Metin adı</Label>
            <Input
              id="text-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Oda tipleri ve fiyatlar"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="text-content">Metin içeriği</Label>
            <Textarea
              id="text-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Standart oda 2 kişilik, kahvaltı dahil, gecelik 2.500₺..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || !title.trim() || content.trim().length < 20}
          >
            {pending && <Spinner />} Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
