"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { passwordSchema, PASSWORD_HINT } from "@/lib/validations/password"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconLock, IconCheck } from "@tabler/icons-react"
import { toast } from "sonner"

type PageState = "loading" | "ready" | "success" | "error"

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>("loading")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Supabase places the recovery token in the URL hash after redirect.
    // onAuthStateChange fires with SIGNED_IN / PASSWORD_RECOVERY events.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready")
      } else if (event === "SIGNED_IN") {
        // Covers the case where the session is already established
        setPageState("ready")
      }
    })

    // If the hash contains access_token, the session will be auto-exchanged.
    // Give Supabase a moment to process the token before showing an error.
    const timeout = setTimeout(() => {
      setPageState((prev) => (prev === "loading" ? "error" : prev))
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (password !== confirmPassword) {
      setValidationError("Şifreler eşleşmiyor")
      return
    }

    const result = passwordSchema.safeParse(password)
    if (!result.success) {
      setValidationError(result.error.issues[0].message)
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast.error("Şifre güncellenemedi. Lütfen bağlantıyı yeniden kullanmayı deneyin.")
        return
      }

      setPageState("success")
      toast.success("Şifreniz başarıyla güncellendi!")

      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <IconLock className="size-6" />
          </div>
          <CardTitle className="text-2xl">Şifre Sıfırlama</CardTitle>
          <CardDescription>
            {pageState === "loading" && "Bağlantı doğrulanıyor..."}
            {pageState === "ready" && "Yeni şifrenizi belirleyin."}
            {pageState === "success" && "Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz."}
            {pageState === "error" && "Geçersiz veya süresi dolmuş bağlantı."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {pageState === "loading" && (
            <div className="flex justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {pageState === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="password">Yeni Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                loading={isSubmitting}
                disabled={!password || !confirmPassword}
              >
                Şifremi Güncelle
              </Button>
            </form>
          )}

          {pageState === "success" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
                <IconCheck className="size-6" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Yeni şifrenizle giriş yapabilirsiniz.
              </p>
            </div>
          )}

          {pageState === "error" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                Bu bağlantı geçersiz veya süresi dolmuş. Lütfen şifre sıfırlama işlemini yeniden başlatın.
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/login")}
              >
                Giriş Sayfasına Dön
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
