"use client"

import { useCallback, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_IMAGE_EXTS,
  classifyAttachmentKind,
} from "@/lib/assistant/attachments/constants"
import { fileExtOf, mimeForFileExt } from "@/lib/knowledge/file-upload"
import { cn } from "@/lib/utils"

export type PendingAttachment = {
  localId: string
  file: File
  previewUrl: string | null
}

function mimeForAttachment(file: File): string {
  const ext = fileExtOf(file.name)
  const imageMime: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }
  if (imageMime[ext]) return imageMime[ext]
  return mimeForFileExt(ext, file.type)
}

function validateAttachment(file: File): string | null {
  const ext = fileExtOf(file.name)
  const mime = mimeForAttachment(file)
  if (!classifyAttachmentKind(mime, ext)) {
    return "Desteklenmeyen dosya türü"
  }
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    return "Dosya 20 MB sınırını aşıyor"
  }
  return null
}

function PendingAttachmentTile({
  item,
  onRemove,
}: {
  item: PendingAttachment
  onRemove: () => void
}) {
  const isImage = !!item.previewUrl

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative size-14 shrink-0"
    >
      <div
        className="bg-muted size-14 overflow-hidden rounded-xl border shadow-sm"
        title={item.file.name}
      >
        {isImage ? (
          <img
            src={item.previewUrl!}
            alt={item.file.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 px-1">
            <FileText className="text-muted-foreground size-5 shrink-0" />
            <span className="text-muted-foreground w-full truncate text-center text-xs leading-none">
              {item.file.name}
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="bg-background text-foreground hover:bg-muted absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-xl border shadow-sm transition-colors"
        aria-label={`${item.file.name} kaldır`}
      >
        <X className="size-3" />
      </button>
    </motion.div>
  )
}

export function PreviewComposer({
  canChat,
  busy,
  onSend,
  onStop,
}: {
  canChat: boolean
  busy: boolean
  onSend: (payload: { text: string; files: File[] }) => void | Promise<void>
  onStop?: () => void
}) {
  const [input, setInput] = useState("")
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const addFiles = useCallback((files: File[]) => {
    const accepted: PendingAttachment[] = []
    for (const file of files) {
      const err = validateAttachment(file)
      if (err) {
        toast.error(file.name, { description: err })
        continue
      }
      const ext = fileExtOf(file.name)
      const isImage = CHAT_IMAGE_EXTS.includes(ext as (typeof CHAT_IMAGE_EXTS)[number])
      accepted.push({
        localId: crypto.randomUUID(),
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
      })
    }
    if (accepted.length > 0) {
      setPending((prev) => [...prev, ...accepted])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: addFiles,
    noClick: true,
    noKeyboard: true,
    disabled: !canChat || uploading,
  })

  function removePending(localId: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.localId === localId)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((p) => p.localId !== localId)
    })
  }

  async function handleSend() {
    const text = input.trim()
    if (!canChat || uploading) return
    if (!text && pending.length === 0) return

    const filesToSend = pending.map((p) => p.file)
    const urlsToRevoke = pending
      .map((p) => p.previewUrl)
      .filter((u): u is string => !!u)

    // Clear immediately so the user can compose/send the next message while the
    // assistant is still "yazıyor…" (WhatsApp parity).
    setInput("")
    setPending([])

    setUploading(true)
    try {
      await onSend({ text, files: filesToSend })
    } finally {
      setUploading(false)
      for (const url of urlsToRevoke) URL.revokeObjectURL(url)
    }
  }

  const hasContent = input.trim().length > 0 || pending.length > 0
  const showStop = busy && !hasContent && !uploading
  const sendDisabled =
    !canChat || uploading || (!input.trim() && pending.length === 0)

  return (
    // Same frame as the inbox composer — a border off the thread, the thread's
    // own padding, and the column width it is answering into.
    <div {...getRootProps()} className="bg-background shrink-0 border-t px-6 py-4">
      <input {...getInputProps({ className: "sr-only", accept: CHAT_ATTACHMENT_ACCEPT })} />

      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) textareaRef.current?.focus()
        }}
        className={cn(
          "bg-background mx-auto flex w-full max-w-3xl cursor-text flex-col gap-2 rounded-[1.75rem] border px-2.5 py-2.5 shadow-sm transition-colors",
          "focus-within:border-ring focus-within:ring-ring/40 focus-within:ring-[3px]",
          isDragActive && "border-primary/50 bg-muted/40 ring-primary/20 ring-[3px]",
          !canChat && "opacity-95"
        )}
      >
        <AnimatePresence initial={false}>
          {pending.length > 0 && (
            <motion.div
              key="attachments"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 overflow-x-auto px-1 pt-1 pb-0.5 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
                <AnimatePresence mode="popLayout">
                  {pending.map((item) => (
                    <PendingAttachmentTile
                      key={item.localId}
                      item={item}
                      onRemove={() => removePending(item.localId)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          disabled={!canChat}
          rows={1}
          placeholder={isDragActive ? "Dosyaları buraya bırak" : "Bir mesaj yaz…"}
          className={cn(
            "max-h-44 min-h-11 resize-none border-0 bg-transparent px-2 py-1.5 text-base leading-relaxed shadow-none",
            "field-sizing-content focus-visible:ring-0 dark:bg-transparent"
          )}
        />

        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-9 rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                open()
              }}
              disabled={!canChat || uploading}
              aria-label="Dosya ekle"
            >
              <Paperclip className="size-[18px]" />
            </Button>
          </div>

          {showStop ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-9 rounded-full"
              onClick={onStop}
              aria-label="Durdur"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="size-9 rounded-full"
              onClick={() => void handleSend()}
              disabled={sendDisabled}
              aria-label="Gönder"
            >
              {uploading ? (
                <Spinner className="size-4" />
              ) : (
                <ArrowUp className="size-[18px]" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
