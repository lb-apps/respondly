"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { translateAuthError } from "@/lib/auth-errors"
import { passwordSchema, PASSWORD_HINT } from "@/lib/validations/password"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { IconEye, IconEyeOff, IconUser } from "@tabler/icons-react"

const AvatarCropDialog = dynamic(
  () => import("@/components/avatar-crop-dialog").then((m) => ({ default: m.AvatarCropDialog })),
  { ssr: false },
)

const ImagePickerDialog = dynamic(
  () => import("@/components/dialogs/image-picker-dialog").then((m) => ({ default: m.ImagePickerDialog })),
  { ssr: false },
)

export interface ProfileStepHandle {
  submit: () => Promise<boolean>
  canProceed: boolean
  isLoading: boolean
}

interface ProfileStepProps {
  onNext: (email: string) => void
}

function getInitials(firstName: string, lastName: string): string {
  const f = firstName.charAt(0)
  const l = lastName.charAt(0)
  return (f + l).toUpperCase() || "U"
}

const SK = {
  firstName: "signup_first_name",
  lastName: "signup_last_name",
  email: "signup_email",
} as const

const supabase = createClient()

export const ProfileStep = forwardRef<ProfileStepHandle, ProfileStepProps>(
  function ProfileStep({ onNext }, ref) {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")

    useEffect(() => {
      setFirstName(sessionStorage.getItem(SK.firstName) ?? "")
      setLastName(sessionStorage.getItem(SK.lastName) ?? "")
      setEmail(sessionStorage.getItem(SK.email) ?? "")
    }, [])

    const updateFirstName = (v: string) => { setFirstName(v); sessionStorage.setItem(SK.firstName, v) }
    const updateLastName = (v: string) => { setLastName(v); sessionStorage.setItem(SK.lastName, v) }
    const updateEmail = (v: string) => { setEmail(v); sessionStorage.setItem(SK.email, v) }
    const [password, setPassword] = useState("")
    const [passwordConfirm, setPasswordConfirm] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isCropOpen, setIsCropOpen] = useState(false)
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
    const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null)
    const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null)

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
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview)
      setPendingAvatarBlob(blob)
      setPendingAvatarPreview(URL.createObjectURL(blob))
      closeCropDialog()
    }

    const handleRemoveAvatar = () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview)
      setPendingAvatarBlob(null)
      setPendingAvatarPreview(null)
    }

    const canProceed = Boolean(
      firstName.trim() && lastName.trim() && email.trim() && password && passwordConfirm
    )

    const handleSubmit = useCallback(async (): Promise<boolean> => {
      setIsLoading(true)
      try {
        const { data: { user: existingUser } } = await supabase.auth.getUser()

        if (existingUser) {
          const updates: Parameters<typeof supabase.auth.updateUser>[0] = {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            },
          }
          if (existingUser.email !== email.trim()) {
            updates.email = email.trim()
          }

          const { error: updateError } = await supabase.auth.updateUser(updates)
          if (updateError) {
            console.error("[ProfileStep] updateUser error:", updateError.message)
            toast.error(translateAuthError(updateError.message, "signup"))
            return false
          }

          if (pendingAvatarBlob) {
            const fileName = `${existingUser.id}/avatar.webp`
            const { error: uploadError } = await supabase.storage
              .from("avatars")
              .upload(fileName, pendingAvatarBlob, { contentType: "image/webp", upsert: true })

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName)
              await supabase
                .from("profiles")
                .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
                .eq("id", existingUser.id)
            }
          }

          onNext(email.trim())
          return true
        }

        // Brand-new user — validate password and sign up
        const parsed = passwordSchema.safeParse(password)
        if (!parsed.success) {
          toast.error("Şifre en az 8 karakter, bir harf ve bir rakam içermelidir.")
          return false
        }
        if (password !== passwordConfirm) {
          toast.error("Şifreler eşleşmiyor")
          return false
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Magic link in the confirmation email lands here; the callback
            // exchanges the code and drops the user back into the open signup
            // flow at the organization step.
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/signup")}`,
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            },
          },
        })

        if (error) {
          console.error("[ProfileStep] signUp error:", error.message)

          if (error.message.toLowerCase().includes("rate limit")) {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            })
            if (!signInError && signInData.user) {
              onNext(email.trim())
              return true
            }
            toast.error("E-posta gönderim limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.")
            return false
          }

          toast.error(translateAuthError(error.message, "signup"))
          return false
        }

        if (!data.user) {
          console.error("[ProfileStep] signUp returned no user — possible duplicate email")
          toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
          return false
        }

        if (data.user.identities?.length === 0) {
          console.error("[ProfileStep] signUp duplicate email (identities empty)")
          toast.error(translateAuthError("User already registered", "signup"))
          return false
        }

        if (pendingAvatarBlob) {
          const fileName = `${data.user.id}/avatar.webp`
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, pendingAvatarBlob, { contentType: "image/webp", upsert: true })

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName)
            await supabase
              .from("profiles")
              .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
              .eq("id", data.user.id)
          }
        }

        onNext(email.trim())
        return true
      } catch (err) {
        console.error("[ProfileStep] unexpected error:", err)
        toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
        return false
      } finally {
        setIsLoading(false)
      }
    }, [email, firstName, lastName, password, passwordConfirm, pendingAvatarBlob, onNext])

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
          title="Fotoğraf Seçin"
          maxSizeMb={2}
        />
        <AvatarCropDialog
          imageSrc={cropImageSrc ?? ""}
          open={isCropOpen}
          onClose={closeCropDialog}
          onCrop={handleCropConfirm}
          title="Fotoğrafı Düzenle"
        />

        <div className="flex flex-col gap-7">
          <div className="flex items-center justify-between rounded-2xl border p-3.5">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={pendingAvatarPreview ?? undefined} />
                <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">
                  {firstName.trim() || lastName.trim()
                    ? getInitials(firstName, lastName)
                    : <IconUser className="size-5 text-muted-foreground" />
                  }
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Profil fotoğrafı</span>
                <span className="text-xs text-muted-foreground">Opsiyonel</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingAvatarPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                >
                  Kaldır
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPickerOpen(true)}
              >
                {pendingAvatarPreview ? "Değiştir" : "Yükle"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium text-foreground">Ad</Label>
              <Input
                id="firstName"
                placeholder="Ad"
                value={firstName}
                onChange={(e) => updateFirstName(e.target.value)}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium text-foreground">Soyad</Label>
              <Input
                id="lastName"
                placeholder="Soyad"
                value={lastName}
                onChange={(e) => updateLastName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">E-posta</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => updateEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="passwordConfirm" className="text-sm font-medium text-foreground">Şifre tekrar</Label>
                <div className="relative">
                  <Input
                    id="passwordConfirm"
                    type={showPasswordConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPasswordConfirm((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPasswordConfirm ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
          </div>
        </div>
      </>
    )
  }
)
