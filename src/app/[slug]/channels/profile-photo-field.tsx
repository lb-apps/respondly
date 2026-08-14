"use client"

import dynamic from "next/dynamic"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ImageUp } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import {
  PROFILE_PHOTO_EDGE,
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_MIME_TYPES,
} from "@/lib/whatsapp/cloud-api/business-profile-limits"
import {
  WHATSAPP_PROFILE_BUCKET,
  whatsappProfilePublicUrl,
} from "@/lib/whatsapp/profile/storage"
import { setWhatsAppProfilePhoto } from "./profile-actions"

const AvatarCropDialog = dynamic(
  () => import("@/components/avatar-crop-dialog").then((m) => m.AvatarCropDialog),
  { ssr: false }
)

interface Props {
  slug: string
  channelId: string
  organizationId: string
  storagePath: string | null
  /** Fallback when the org set its photo in WhatsApp Manager, not here. */
  metaPictureUrl: string | null
}

type Stage = "idle" | "uploading" | "pushing"

const ACCEPT = "image/jpeg,image/png"

export function ProfilePhotoField({
  slug,
  channelId,
  organizationId,
  storagePath,
  metaPictureUrl,
}: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [error, setError] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const busy = stage !== "idle"
  const ownUrl = storagePath ? whatsappProfilePublicUrl(storagePath) : null
  const shownUrl = ownUrl ?? metaPictureUrl

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset immediately so picking the same file twice fires onChange again.
    event.target.value = ""
    if (!file) return

    setError(null)
    if (!PROFILE_PHOTO_MIME_TYPES.has(file.type)) {
      setError("Desteklenmeyen tür. JPG veya PNG yükle.")
      return
    }
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      setError("Fotoğraf çok büyük (en fazla 5 MB).")
      return
    }
    setCropSrc(URL.createObjectURL(file))
  }

  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  async function upload(blob: Blob) {
    closeCrop()
    setError(null)
    setStage("uploading")

    const supabase = createClient()
    const path = `${organizationId}/${crypto.randomUUID()}.jpg`
    const { error: upErr } = await supabase.storage
      .from(WHATSAPP_PROFILE_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg" })

    if (upErr) {
      setStage("idle")
      setError("Fotoğraf yüklenemedi.")
      return
    }

    setStage("pushing")
    const res = await setWhatsAppProfilePhoto({ channelId, slug, storagePath: path })
    setStage("idle")

    if (!res.ok) {
      // Roll the orphan back rather than leaving a paid-for object nothing
      // points at.
      await supabase.storage.from(WHATSAPP_PROFILE_BUCKET).remove([path])
      setError(res.error)
      toast.error("Fotoğraf güncellenemedi", { description: res.error })
      return
    }

    toast.success("Profil fotoğrafı güncellendi", {
      description: "WhatsApp'ta görünmesi birkaç dakika sürebilir.",
    })
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profil fotoğrafı</CardTitle>
        <CardDescription>
          Müşterilerin sohbet ekranında gördüğü resim. Kare olmalı; en az{" "}
          {PROFILE_PHOTO_EDGE}×{PROFILE_PHOTO_EDGE} piksel öneriyoruz.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="size-16">
              {shownUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shownUrl}
                  alt="WhatsApp profil fotoğrafı"
                  className="size-full object-cover"
                />
              ) : (
                <AvatarFallback>
                  <ImageUp className="text-muted-foreground size-5" />
                </AvatarFallback>
              )}
            </Avatar>
            {busy && (
              <span className="bg-background/70 absolute inset-0 grid place-items-center rounded-full">
                <Spinner />
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            {/* The file input is the labelled control; the button just opens it,
                so the label stays genuinely associated rather than decorative. */}
            <Label htmlFor="wa-profile-photo" className="sr-only">
              Profil fotoğrafı seç
            </Label>
            <input
              ref={inputRef}
              id="wa-profile-photo"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={pickFile}
            />
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="w-fit"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ImageUp className="size-4" />
              {shownUrl ? "Değiştir" : "Yükle"}
            </Button>
            {!shownUrl && (
              <p className="text-muted-foreground text-xs">Henüz fotoğraf yok.</p>
            )}
            {!ownUrl && metaPictureUrl && (
              <p className="text-muted-foreground text-xs">
                Bu fotoğraf Meta&apos;da ayarlanmış. Buradan değiştirebilirsin.
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-destructive text-xs">{error}</p>}
      </CardContent>

      {cropSrc && (
        <AvatarCropDialog
          open
          imageSrc={cropSrc}
          title="Profil fotoğrafını düzenle"
          outputSize={PROFILE_PHOTO_EDGE}
          // JPEG, not the default webp: Meta accepts a webp upload and then
          // never renders it.
          outputType="image/jpeg"
          onClose={closeCrop}
          onCrop={upload}
        />
      )}
    </Card>
  )
}
