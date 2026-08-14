"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ImagePlus, Loader2, Plus, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import {
  KNOWLEDGE_IMAGE_BUCKET,
  IMAGE_MAX_BYTES,
  KNOWLEDGE_IMAGE_EXTENSIONS,
  MEDIA_LIBRARY_LABEL,
} from "@/lib/knowledge/constants"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/knowledge/quota"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import { FolderSelect } from "../knowledge/folder-select"
import { ActionCard } from "../knowledge/action-card"
import { createImageSource } from "../knowledge/actions"

const IMAGE_ACCEPT = KNOWLEDGE_IMAGE_EXTENSIONS.map((e) => `.${e}`).join(",")

const RAW_MAX_BYTES = 50 * 1024 * 1024

const COMPRESSION_TIMEOUT_MS = 12_000
const MEDIA_IMAGE_MAX_EDGE = 1280
const JPEG_MIME_TYPE = "image/jpeg"
const JPEG_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5] as const
const EDGE_SCALE_STEPS = [1, 0.85, 0.7] as const

type PhotoStatus = "compressing" | "idle" | "uploading" | "done" | "error"

interface PhotoEntry {
  id: string
  file: File
  preview: string
  title: string
  desc: string
  status: PhotoStatus
  errorMsg?: string
}

function imageOutputName(file: File) {
  return `${file.name.replace(/\.[^.]+$/, "")}.jpg`
}

function imageSize(image: ImageBitmap | HTMLImageElement) {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight }
  }
  return { width: image.width, height: image.height }
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Compression aborted", "AbortError")
  }
}

async function loadImage(file: File, signal: AbortSignal) {
  throwIfAborted(signal)

  if ("createImageBitmap" in window) {
    return createImageBitmap(file, { imageOrientation: "from-image" })
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Görsel okunamadı"))
    }

    signal.addEventListener(
      "abort",
      () => {
        URL.revokeObjectURL(url)
        reject(new DOMException("Compression aborted", "AbortError"))
      },
      { once: true }
    )

    image.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  signal: AbortSignal
) {
  throwIfAborted(signal)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (signal.aborted) {
          reject(new DOMException("Compression aborted", "AbortError"))
          return
        }
        if (!blob) {
          reject(new Error("Görsel sıkıştırılamadı"))
          return
        }
        resolve(blob)
      },
      JPEG_MIME_TYPE,
      quality
    )
  })
}

async function compressImageForUpload(file: File, signal: AbortSignal) {
  if (file.size <= IMAGE_MAX_BYTES) return file

  const image = await loadImage(file, signal)

  try {
    const { width, height } = imageSize(image)
    const longestEdge = Math.max(width, height)
    const baseScale = Math.min(1, MEDIA_IMAGE_MAX_EDGE / longestEdge)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) throw new Error("Görsel işlenemedi")

    for (const edgeScale of EDGE_SCALE_STEPS) {
      const scale = baseScale * edgeScale
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

      for (const quality of JPEG_QUALITY_STEPS) {
        throwIfAborted(signal)
        const blob = await canvasToBlob(canvas, quality, signal)
        if (blob.size <= IMAGE_MAX_BYTES) {
          return new File([blob], imageOutputName(file), {
            type: JPEG_MIME_TYPE,
            lastModified: Date.now(),
          })
        }
      }
    }
  } finally {
    if (image instanceof ImageBitmap) image.close()
  }

  throw new Error(
    `Görsel ${formatBytes(IMAGE_MAX_BYTES)} altına indirilemedi.`
  )
}

export function AddImageDialog({
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
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [batchDesc, setBatchDesc] = useState("")
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId)
  const [dragging, setDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const compressionControllers = useRef(new Map<string, AbortController>())

  function reset() {
    compressionControllers.current.forEach((controller) => controller.abort())
    compressionControllers.current.clear()
    setPhotos((prev) => {
      prev.forEach((p) => {
        URL.revokeObjectURL(p.preview)
      })
      return []
    })
    setBatchDesc("")
    setFolderId(defaultFolderId)
    setIsUploading(false)
  }

  function pickFiles(files: FileList | File[]) {
    const next: PhotoEntry[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
      if (!(KNOWLEDGE_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
        toast.error(`Desteklenmeyen tür: .${ext}`)
        continue
      }
      if (file.size > RAW_MAX_BYTES) {
        toast.error(
          `${file.name} çok büyük (en fazla ${formatBytes(RAW_MAX_BYTES)})`
        )
        continue
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        title: file.name.replace(/\.[^.]+$/, ""),
        desc: "",
        status: "idle",
      })
    }
    if (next.length) {
      setPhotos((prev) => [...prev, ...next])
    }
  }

  async function preparePhotoForUpload(photo: PhotoEntry) {
    if (photo.file.size <= IMAGE_MAX_BYTES) return photo.file

    updatePhoto(photo.id, { status: "compressing", errorMsg: undefined })
    const controller = new AbortController()
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, COMPRESSION_TIMEOUT_MS)

    compressionControllers.current.set(photo.id, controller)

    try {
      const compressed = await compressImageForUpload(photo.file, controller.signal)
      if (compressed === photo.file) return compressed

      const preview = URL.createObjectURL(compressed)
      setPhotos((prev) => {
        let replaced = false
        const next = prev.map((p) => {
          if (p.id !== photo.id) return p
          replaced = true
          URL.revokeObjectURL(p.preview)
          return { ...p, file: compressed, preview }
        })
        if (!replaced) URL.revokeObjectURL(preview)
        return next
      })
      return compressed
    } catch {
      if (controller.signal.aborted && !timedOut) {
        throw new Error("Sıkıştırma iptal edildi.")
      }
      throw new Error(
        timedOut
          ? "Görseli küçültmek çok uzun sürdü. Daha küçük bir görsel deneyin."
          : `Görsel ${formatBytes(IMAGE_MAX_BYTES)} altına indirilemedi.`
      )
    } finally {
      window.clearTimeout(timeout)
      compressionControllers.current.delete(photo.id)
    }
  }

  function removePhoto(id: string) {
    compressionControllers.current.get(id)?.abort()
    compressionControllers.current.delete(id)
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id)
      if (photo) URL.revokeObjectURL(photo.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  function updatePhoto(id: string, patch: Partial<PhotoEntry>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function effectiveDesc(photo: PhotoEntry) {
    return photo.desc.trim() || batchDesc.trim()
  }

  function isPhotoValid(photo: PhotoEntry) {
    return effectiveDesc(photo).length >= 20
  }

  async function uploadOne(
    photo: PhotoEntry
  ): Promise<{ id: string; ok: boolean; errorMsg?: string }> {
    let uploadFile: File
    try {
      uploadFile = await preparePhotoForUpload(photo)
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Görsel küçültülemedi"
      updatePhoto(photo.id, { status: "error", errorMsg })
      return { id: photo.id, ok: false, errorMsg }
    }

    updatePhoto(photo.id, { status: "uploading", errorMsg: undefined })

    const supabase = createClient()
    const type = uploadFile.type || "image/jpeg"
    const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1] || "jpg"
    const path = `${organizationId}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from(KNOWLEDGE_IMAGE_BUCKET)
      .upload(path, uploadFile, {
        contentType: uploadFile.type || `image/${ext}`,
      })

    if (upErr) {
      updatePhoto(photo.id, { status: "error", errorMsg: upErr.message })
      return { id: photo.id, ok: false, errorMsg: upErr.message }
    }

    const res = await createImageSource({
      organizationId,
      assistantId,
      slug,
      folderId,
      title: photo.title.trim() || photo.file.name.replace(/\.[^.]+$/, ""),
      description: effectiveDesc(photo),
      storagePath: path,
      mimeType: uploadFile.type || null,
      sizeBytes: uploadFile.size,
    })

    if (!res.ok) {
      await supabase.storage.from(KNOWLEDGE_IMAGE_BUCKET).remove([path])
      updatePhoto(photo.id, { status: "error", errorMsg: res.error })
      return { id: photo.id, ok: false, errorMsg: res.error }
    }

    updatePhoto(photo.id, { status: "done" })
    return { id: photo.id, ok: true }
  }

  async function submit() {
    if (isUploading) return
    setIsUploading(true)

    const results: { id: string; ok: boolean; errorMsg?: string }[] = []
    for (const photo of photos) {
      results.push(await uploadOne(photo))
    }
    setIsUploading(false)

    const successCount = results.filter((r) => r.ok).length
    const failCount = results.filter((r) => !r.ok).length

    if (failCount === 0) {
      toast.success(`${successCount} görsel eklendi`)
      setOpen(false)
      reset()
      onDone()
    } else {
      if (successCount > 0) {
        toast.success(`${successCount} görsel eklendi`)
        onDone()
      }
      toast.error(`${failCount} görsel yüklenemedi — tekrar deneyebilirsiniz`)
    }
  }

  async function retryPhoto(id: string) {
    const photo = photos.find((p) => p.id === id)
    if (!photo) return

    const result = await uploadOne(photo)

    if (result.ok) {
      const remaining = photos.filter((p) => p.id !== id && p.status !== "done")
      if (remaining.length === 0) {
        toast.success("Tüm görseller eklendi")
        setOpen(false)
        reset()
        onDone()
      }
    } else {
      toast.error(result.errorMsg ?? "Yükleme başarısız")
    }
  }

  const hasPhotos = photos.length > 0
  const isSingle = photos.length === 1
  const singlePhoto = isSingle ? photos[0] : undefined
  const isCompressing = photos.some((p) => p.status === "compressing")
  const allReady =
    hasPhotos &&
    photos.every((p) => p.status === "idle" && isPhotoValid(p))
  const submitEnabled = allReady && !isUploading && !isCompressing

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (isUploading) return
        setOpen(o)
        reset()
      }}
    >
      <DialogTrigger asChild>
        <ActionCard icon={ImagePlus} label="Fotoğraf Ekle" />
      </DialogTrigger>
      <DialogContent
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0",
          isSingle
            ? "sm:max-w-md"
            : hasPhotos
              ? "sm:max-w-4xl"
              : "sm:max-w-xl"
        )}
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle>Fotoğraf Ekle</DialogTitle>
          <DialogDescription>
            Görsel yükle ve asistanın bulmak için kullanacağı bir açıklama yaz.
          </DialogDescription>
        </DialogHeader>

        {/* Shared hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) pickFiles(e.target.files)
            e.target.value = ""
          }}
        />

        {!hasPhotos ? (
          /* ── Empty: album select + dropzone ── */
          <div className="flex flex-col gap-4 px-6 pb-6">
            <FolderSelect
              folders={folders}
              value={folderId}
              onChange={setFolderId}
              label="Albüm"
              rootLabel={MEDIA_LIBRARY_LABEL}
            />
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
                if (e.dataTransfer.files.length) pickFiles(e.dataTransfer.files)
              }}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent/40",
                dragging && "border-primary bg-accent/40"
              )}
            >
              <ImagePlus className="size-6" />
              <span className="font-medium">Sürükle bırak ya da tıkla</span>
              <span>Birden fazla fotoğraf seçebilirsiniz</span>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {KNOWLEDGE_IMAGE_EXTENSIONS.map((e) => (
                  <Badge key={e} variant="secondary" className="text-xs">
                    {e}
                  </Badge>
                ))}
              </div>
              <span className="text-xs">
                Yüklerken her görsel {formatBytes(IMAGE_MAX_BYTES)} altına küçültülür
              </span>
            </button>
          </div>
        ) : isSingle && singlePhoto ? (
          /* ── Single photo: focused form ── */
          <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6">
            {/* Photo preview */}
            <div className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={singlePhoto.preview}
                alt={singlePhoto.title}
                className="size-full object-cover"
              />
              {(singlePhoto.status === "uploading" ||
                singlePhoto.status === "compressing") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  {singlePhoto.status === "compressing" && (
                    <span className="text-xs font-medium">Sıkıştırılıyor…</span>
                  )}
                </div>
              )}
              {singlePhoto.status === "done" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Badge className="border-primary/30 bg-primary/10 text-primary shadow-none">
                    ✓ Eklendi
                  </Badge>
                </div>
              )}
              {singlePhoto.status !== "uploading" &&
                singlePhoto.status !== "compressing" &&
                singlePhoto.status !== "done" && (
                  <button
                    type="button"
                    aria-label="Kaldır"
                    onClick={() => removePhoto(singlePhoto.id)}
                    disabled={isUploading}
                    className="bg-foreground/50 text-background hover:bg-foreground/80 absolute top-2 right-2 flex size-7 items-center justify-center rounded-full opacity-0 transition-all group-hover:opacity-100 disabled:pointer-events-none"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
            </div>

            {/* Add more */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="size-3" />
              Daha fazla fotoğraf ekle
            </button>

            {/* Error */}
            {singlePhoto.status === "error" && (
              <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-3 py-2">
                <p className="flex-1 truncate text-xs text-destructive">
                  {singlePhoto.errorMsg ?? "Yükleme başarısız"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => retryPhoto(singlePhoto.id)}
                >
                  <RefreshCw className="mr-1 size-3" />
                  Tekrar
                </Button>
              </div>
            )}

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="single-title">Başlık</Label>
              <Input
                id="single-title"
                value={singlePhoto.title}
                onChange={(e) =>
                  updatePhoto(singlePhoto.id, { title: e.target.value })
                }
                disabled={isUploading || singlePhoto.status === "done"}
              />
            </div>

            {/* Description */}
            {singlePhoto.status !== "done" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="single-desc">Açıklama</Label>
                <Textarea
                  id="single-desc"
                  rows={3}
                  value={singlePhoto.desc}
                  onChange={(e) =>
                    updatePhoto(singlePhoto.id, { desc: e.target.value })
                  }
                  placeholder="örn. Kahvaltı salonu, sabah açık büfe servisi, Türk ve Batı seçenekleri"
                  className="resize-none"
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  {singlePhoto.desc.trim().length === 0
                    ? "En az 20 karakter"
                    : singlePhoto.desc.trim().length < 20
                      ? `${singlePhoto.desc.trim().length} / 20`
                      : `${singlePhoto.desc.trim().length} karakter`}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Multiple photos: album + batch desc + grid ── */
          <>
            {/* Controls strip */}
            <div className="shrink-0 space-y-4 border-b px-6 py-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <FolderSelect
                    folders={folders}
                    value={folderId}
                    onChange={setFolderId}
                    label="Albüm"
                    rootLabel={MEDIA_LIBRARY_LABEL}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Plus className="size-3.5" />
                  Fotoğraf Ekle
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="batch-desc">Toplu Açıklama</Label>
                <Textarea
                  id="batch-desc"
                  rows={2}
                  value={batchDesc}
                  onChange={(e) => setBatchDesc(e.target.value)}
                  disabled={isUploading}
                  placeholder="örn. Kahvaltı salonu, sabah açık büfe servisi, Türk ve Batı seçenekleri"
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {batchDesc.trim().length === 0
                    ? "Boş bırakılırsa her görsel kendi açıklamasını kullanır."
                    : batchDesc.trim().length < 20
                      ? `${batchDesc.trim().length} / 20`
                      : `${batchDesc.trim().length} karakter`}
                </p>
              </div>
            </div>

            {/* Photo grid */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {photos.map((photo) => (
                    <motion.div
                      key={photo.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/60"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.preview}
                          alt={photo.title}
                          className="size-full object-cover"
                        />
                        {(photo.status === "uploading" ||
                          photo.status === "compressing") && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70">
                            <Loader2 className="size-6 animate-spin text-primary" />
                            {photo.status === "compressing" && (
                              <span className="text-xs font-medium">
                                Sıkıştırılıyor…
                              </span>
                            )}
                          </div>
                        )}
                        {photo.status === "done" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                            <Badge className="border-primary/30 bg-primary/10 text-primary shadow-none">
                              ✓ Eklendi
                            </Badge>
                          </div>
                        )}
                        {photo.status !== "uploading" &&
                          photo.status !== "compressing" &&
                          photo.status !== "done" && (
                            <button
                              type="button"
                              aria-label="Kaldır"
                              onClick={() => removePhoto(photo.id)}
                              disabled={isUploading}
                              className="bg-foreground/50 text-background hover:bg-foreground/80 absolute top-2 right-2 flex size-7 items-center justify-center rounded-full opacity-0 transition-all group-hover:opacity-100 disabled:pointer-events-none"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                      </div>

                      {/* Card body */}
                      <div className="flex flex-col gap-2 p-2">
                        <Input
                          value={photo.title}
                          onChange={(e) =>
                            updatePhoto(photo.id, { title: e.target.value })
                          }
                          placeholder="Başlık"
                          className="h-7 px-2 text-sm font-medium"
                          disabled={isUploading || photo.status === "done"}
                        />

                        {photo.status === "error" && (
                          <div className="flex items-center gap-2">
                            <p className="flex-1 truncate text-xs text-destructive">
                              {photo.errorMsg ?? "Yükleme başarısız"}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => retryPhoto(photo.id)}
                            >
                              <RefreshCw className="mr-1 size-3" />
                              Tekrar
                            </Button>
                          </div>
                        )}

                        {photo.status !== "done" && (
                          <Textarea
                            rows={2}
                            value={photo.desc}
                            onChange={(e) =>
                              updatePhoto(photo.id, { desc: e.target.value })
                            }
                            placeholder="Açıklama (isteğe bağlı — min. 20 karakter)"
                            className="resize-none px-2 text-xs"
                            disabled={isUploading}
                          />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}

        <DialogFooter className="shrink-0 items-center border-t px-6 py-4">
          {!isSingle && hasPhotos && (
            <p className="mr-auto text-sm text-muted-foreground">
              {photos.length} fotoğraf seçildi
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (!isUploading) {
                setOpen(false)
                reset()
              }
            }}
            disabled={isUploading}
          >
            Vazgeç
          </Button>
          {hasPhotos && (
            <Button onClick={submit} disabled={!submitEnabled}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isCompressing ? "Küçültülüyor…" : "Yükleniyor…"}
                </>
              ) : isSingle ? (
                "Fotoğraf Yükle"
              ) : (
                `${photos.length} Fotoğraf Yükle`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
