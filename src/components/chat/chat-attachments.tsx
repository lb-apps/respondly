import { FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ChatAttachmentView = {
  id?: string
  kind: "image" | "document"
  filename: string
  mimeType?: string
  signedUrl?: string | null
}

export function ChatAttachmentGrid({
  attachments,
  className,
}: {
  attachments: ChatAttachmentView[]
  className?: string
}) {
  const images = attachments.filter((a) => a.kind === "image" && a.signedUrl)
  const docs = attachments.filter((a) => a.kind === "document")

  if (images.length === 0 && docs.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((img, i) => (
            <div key={img.id ?? i} className="overflow-hidden rounded-xl border">
              <img
                src={img.signedUrl!}
                alt={img.filename}
                className="max-h-40 w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {docs.map((doc, i) => {
            const Icon = FileText
            return (
              <Badge key={doc.id ?? i} variant="secondary" className="gap-1.5 font-normal">
                <Icon className="size-3" />
                <span className="max-w-[140px] truncate">{doc.filename}</span>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function extractFileParts(parts: unknown[]): ChatAttachmentView[] {
  const out: ChatAttachmentView[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const p = part as Record<string, unknown>
    if (p.type !== "file") continue
    const url = typeof p.url === "string" ? p.url : ""
    const mediaType = typeof p.mediaType === "string" ? p.mediaType : ""
    const filename = typeof p.filename === "string" ? p.filename : "dosya"
    const kind: "image" | "document" = mediaType.startsWith("image/") ? "image" : "document"
    if (kind === "image" && url) {
      out.push({ kind: "image", filename, mimeType: mediaType, signedUrl: url })
    } else if (kind === "document") {
      out.push({ kind: "document", filename, mimeType: mediaType })
    }
  }
  return out
}
