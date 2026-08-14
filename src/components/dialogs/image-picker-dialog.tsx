"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { IconCloudUpload } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const DEFAULT_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const DEFAULT_MAX_SIZE_MB = 10

export interface ImagePickerDialogProps {
  open: boolean
  onClose: () => void
  /** Called with the validated File once the user makes a selection. */
  onSelect: (file: File) => void
  /** Dialog heading. Required — the caller knows the context. */
  title: string
  /** Accepted MIME types. Defaults to JPEG, PNG and WebP. */
  acceptedTypes?: string[]
  /** Maximum file size in megabytes. Defaults to 10. */
  maxSizeMb?: number
}

function buildFormatHint(types: string[], maxSizeMb: number) {
  const labels: Record<string, string> = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
    "image/svg+xml": "SVG",
  }
  const names = types.map((t) => labels[t] ?? t).join(", ")
  return `${names} · En fazla ${maxSizeMb} MB`
}

export function ImagePickerDialog({
  open,
  onClose,
  onSelect,
  title,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
}: ImagePickerDialogProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onSelect(accepted[0])
    },
    [onSelect],
  )

  const accept = Object.fromEntries(acceptedTypes.map((t) => [t, []]))

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    fileRejections,
    open: openFilePicker,
  } = useDropzone({
    onDrop,
    accept,
    maxSize: maxSizeMb * 1024 * 1024,
    maxFiles: 1,
    multiple: false,
  })

  const rejectionError = fileRejections[0]?.errors[0]
  const errorMessage = rejectionError
    ? rejectionError.code === "file-too-large"
      ? `Dosya ${maxSizeMb} MB sınırını aşıyor.`
      : rejectionError.code === "file-invalid-type"
        ? `Desteklenmeyen format. ${acceptedTypes.map((t) => t.split("/")[1]?.toUpperCase()).join(", ")} kullanın.`
        : rejectionError.message
    : null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/30",
          )}
        >
          <input {...getInputProps()} />

          <IconCloudUpload
            className={cn(
              "size-8 transition-colors",
              isDragActive ? "text-primary" : "text-muted-foreground",
            )}
          />

          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {isDragActive ? "Bırakın" : "Sürükleyip bırakın"}
            </p>
            <p className="text-xs text-muted-foreground">
              {buildFormatHint(acceptedTypes, maxSizeMb)}
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">veya</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={(e) => { e.stopPropagation(); openFilePicker() }}
        >
          Dosya Seçin
        </Button>
      </DialogContent>
    </Dialog>
  )
}
