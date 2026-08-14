"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { createClient } from "@/lib/supabase/client"
import { KNOWLEDGE_BUCKET } from "@/lib/knowledge/constants"
import {
  fileExtOf,
  KNOWLEDGE_FILE_ACCEPT,
  KNOWLEDGE_FILE_MAX_BYTES,
  mimeForFileExt,
} from "@/lib/knowledge/file-upload"
import { cn } from "@/lib/utils"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import { FolderSelect } from "./folder-select"
import { ActionCard } from "./action-card"
import { createFileSource } from "./actions"

const EXT_BADGES = ["epub", "pdf", "docx", "txt", "html", "md"]

export function AddFilesDialog({
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
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    const accepted: File[] = []
    for (const f of Array.from(list)) {
      if (!EXT_BADGES.includes(fileExtOf(f.name))) {
        toast.error(`Desteklenmeyen tür: ${f.name}`)
        continue
      }
      if (f.size > KNOWLEDGE_FILE_MAX_BYTES) {
        toast.error(`${f.name} 21 MB sınırını aşıyor`)
        continue
      }
      accepted.push(f)
    }
    setFiles((prev) => [...prev, ...accepted])
  }

  async function submit() {
    if (files.length === 0) return
    setBusy(true)
    const supabase = createClient()
    let ok = 0
    for (const file of files) {
      const ext = fileExtOf(file.name)
      const path = `${organizationId}/${crypto.randomUUID()}.${ext}`
      const mime = mimeForFileExt(ext, file.type)
      const { error: upErr } = await supabase.storage
        .from(KNOWLEDGE_BUCKET)
        .upload(path, file, { contentType: mime })
      if (upErr) {
        toast.error(`Yükleme başarısız: ${file.name}`, {
          description: upErr.message,
        })
        continue
      }
      const res = await createFileSource({
        organizationId,
        assistantId,
        slug,
        folderId,
        title: file.name.replace(/\.[^.]+$/, ""),
        storagePath: path,
        fileExt: ext,
        mimeType: mime,
        sizeBytes: file.size,
      })
      if (res.ok) ok++
      else toast.error(`İşlenemedi: ${file.name}`, { description: res.error })
    }
    setBusy(false)
    if (ok > 0) {
      toast.success(`${ok} dosya eklendi`)
      setFiles([])
      setOpen(false)
      onDone()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setFolderId(defaultFolderId)
          setFiles([])
        }
      }}
    >
      <DialogTrigger asChild>
        <ActionCard icon={Upload} label="Dosya Ekle" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dosya Ekle</DialogTitle>
          <DialogDescription>
            Birden çok dosya yükleyebilirsin. Dosya başına 21 MB&apos;a kadar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FolderSelect folders={folders} value={folderId} onChange={setFolderId} />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              addFiles(e.dataTransfer.files)
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-accent/40",
              dragging && "border-primary bg-accent/40"
            )}
          >
            <Upload className="size-5" />
            Sürükle bırak ya da tıkla
            <div className="flex flex-wrap justify-center gap-1">
              {EXT_BADGES.map((e) => (
                <Badge key={e} variant="secondary" className="text-xs">
                  {e}
                </Badge>
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={KNOWLEDGE_FILE_ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </button>

          {files.length > 0 && (
            <ul className="flex flex-col gap-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <span className="truncate">{f.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    aria-label="Kaldır"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={busy || files.length === 0}>
            {busy && <Spinner />} Yükle ve ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
