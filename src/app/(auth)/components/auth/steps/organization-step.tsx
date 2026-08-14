"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { slugify } from "@/lib/slugify"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { IconPhoto } from "@tabler/icons-react"

const AvatarCropDialog = dynamic(
  () => import("@/components/avatar-crop-dialog").then((m) => ({ default: m.AvatarCropDialog })),
  { ssr: false },
)

const ImagePickerDialog = dynamic(
  () => import("@/components/dialogs/image-picker-dialog").then((m) => ({ default: m.ImagePickerDialog })),
  { ssr: false },
)

export interface OrganizationStepHandle {
  submit: () => Promise<boolean>
  canProceed: boolean
  isLoading: boolean
}

interface OrganizationStepProps {
  onNext: (orgSlug: string, orgId: string) => void
}

const SK = {
  orgName: "signup_org_name",
  currency: "signup_currency",
  timezone: "signup_timezone",
  sector: "signup_sector",
  teamSize: "signup_team_size",
} as const

export const OrganizationStep = forwardRef<OrganizationStepHandle, OrganizationStepProps>(
  function OrganizationStep({ onNext }, ref) {
    const [orgName, setOrgName] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [currency, setCurrency] = useState("TRY")
    const [timezone, setTimezone] = useState("Europe/Istanbul")
    const [sector, setSector] = useState("Otelcilik")
    const [teamSize, setTeamSize] = useState("2-10")

    useEffect(() => {
      setOrgName(sessionStorage.getItem(SK.orgName) ?? "")
      setCurrency(sessionStorage.getItem(SK.currency) ?? "TRY")
      setTimezone(sessionStorage.getItem(SK.timezone) ?? "Europe/Istanbul")
      setSector(sessionStorage.getItem(SK.sector) ?? "Otelcilik")
      setTeamSize(sessionStorage.getItem(SK.teamSize) ?? "2-10")
    }, [])

    const updateOrgName = (v: string) => { setOrgName(v); sessionStorage.setItem(SK.orgName, v) }
    const updateCurrency = (v: string) => { setCurrency(v); sessionStorage.setItem(SK.currency, v) }
    const updateTimezone = (v: string) => { setTimezone(v); sessionStorage.setItem(SK.timezone, v) }
    const updateSector = (v: string) => { setSector(v); sessionStorage.setItem(SK.sector, v) }
    const updateTeamSize = (v: string) => { setTeamSize(v); sessionStorage.setItem(SK.teamSize, v) }

    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isCropOpen, setIsCropOpen] = useState(false)
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
    const [pendingLogoBlob, setPendingLogoBlob] = useState<Blob | null>(null)
    const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null)

    const supabase = createClient()

    const openCropDialog = (src: string) => {
      setCropImageSrc(src)
      setIsCropOpen(true)
    }

    const closeCropDialog = () => {
      setIsCropOpen(false)
      setTimeout(() => setCropImageSrc(null), 300)
    }

    const handlePickerSelect = useCallback((file: File) => {
      setIsPickerOpen(false)
      const reader = new FileReader()
      reader.onload = () => openCropDialog(reader.result as string)
      reader.readAsDataURL(file)
    }, [])

    const handleCropConfirm = (blob: Blob) => {
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview)
      setPendingLogoBlob(blob)
      setPendingLogoPreview(URL.createObjectURL(blob))
      closeCropDialog()
    }

    const handleRemoveLogo = () => {
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview)
      setPendingLogoBlob(null)
      setPendingLogoPreview(null)
    }

    const slug = slugify(orgName)
    const canProceed = Boolean(orgName.trim() && slug)

    const handleSubmit = useCallback(async (): Promise<boolean> => {
      if (!orgName.trim() || !slug) return false

      setIsLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          toast.error("Oturum bulunamadı. Lütfen tekrar giriş yapın.")
          return false
        }

        const { data, error } = await supabase.rpc("create_organization_with_owner", {
          p_name: orgName.trim(),
          p_slug: slug,
          p_currency: currency,
          p_timezone: timezone,
          p_industry: sector,
        })

        if (error) {
          if (error.code === "23505") {
            toast.error("Bu işletme adı zaten kullanılıyor. Farklı bir ad deneyin.")
          } else {
            toast.error("İşletme oluşturulamadı. Lütfen tekrar deneyin.")
          }
          return false
        }

        const result = data as { id: string; slug: string }

        if (pendingLogoBlob) {
          const fileName = `${result.id}/logo.webp`
          const { error: uploadError } = await supabase.storage
            .from("org-logos")
            .upload(fileName, pendingLogoBlob, { contentType: "image/webp", upsert: true })

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("org-logos").getPublicUrl(fileName)
            await supabase
              .from("organizations")
              .update({ logo_url: `${publicUrl}?t=${Date.now()}` })
              .eq("id", result.id)
          }
        }

        Object.values(SK).forEach((key) => sessionStorage.removeItem(key))
        onNext(result.slug, result.id)
        return true
      } catch {
        toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
        return false
      } finally {
        setIsLoading(false)
      }
    }, [orgName, slug, currency, timezone, sector, pendingLogoBlob, onNext, supabase])

    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
      canProceed,
      isLoading,
    }), [handleSubmit, canProceed, isLoading])

    return (
      <>
        <ImagePickerDialog
          open={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={handlePickerSelect}
          title="Logo Seçin"
          maxSizeMb={2}
        />
        <AvatarCropDialog
          imageSrc={cropImageSrc ?? ""}
          open={isCropOpen}
          onClose={closeCropDialog}
          onCrop={handleCropConfirm}
          title="Logoyu Düzenle"
          maskShape="rounded-square"
        />

        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-foreground">Logo (opsiyonel)</Label>
            <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-muted">
                  {pendingLogoPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pendingLogoPreview} alt="Logo" className="size-full object-cover" />
                    </>
                  ) : (
                    <IconPhoto className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">İşletme Logosu</p>
                  <p className="text-xs text-muted-foreground">Opsiyonel</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingLogoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    disabled={isLoading}
                  >
                    Kaldır
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPickerOpen(true)}
                  disabled={isLoading}
                >
                  {pendingLogoPreview ? "Değiştir" : "Yükle"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgName" className="text-sm font-medium text-foreground">İşletme adı</Label>
            <Input
              id="orgName"
              placeholder="Grand Otel Antalya"
              value={orgName}
              onChange={(e) => updateOrgName(e.target.value)}
              required
              disabled={isLoading}
              autoFocus
            />
            {slug && (
              <p className="text-xs text-muted-foreground">
                dashboard.mydorahotel.com/<span className="font-medium text-foreground">{slug}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">Para birimi</Label>
              <Select value={currency} onValueChange={updateCurrency} disabled={isLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">₺ Türk Lirası (TRY)</SelectItem>
                  <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                  <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">Zaman dilimi</Label>
              <Select value={timezone} onValueChange={updateTimezone} disabled={isLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Istanbul">Europe/Istanbul</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">Sektör</Label>
              <Select value={sector} onValueChange={updateSector} disabled={isLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Otelcilik">Otelcilik</SelectItem>
                  <SelectItem value="Turizm">Turizm</SelectItem>
                  <SelectItem value="Restoran">Restoran</SelectItem>
                  <SelectItem value="Diğer">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-foreground">Ekip büyüklüğü</Label>
              <Select value={teamSize} onValueChange={updateTeamSize} disabled={isLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Kişi</SelectItem>
                  <SelectItem value="2-10">2-10 Kişi</SelectItem>
                  <SelectItem value="11-50">11-50 Kişi</SelectItem>
                  <SelectItem value="51-200">51-200 Kişi</SelectItem>
                  <SelectItem value="200+">200+ Kişi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </>
    )
  }
)
