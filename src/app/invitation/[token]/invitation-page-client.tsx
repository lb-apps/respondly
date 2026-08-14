"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconBuildingBank, IconCheck } from "@tabler/icons-react"
import { toast } from "sonner"
import { translateRole } from "@/lib/i18n/roles"

interface InvitationInfo {
  id: string
  email: string
  organizationName: string
  organizationSlug: string
  roleName: string
}

interface Props {
  token: string
  invitation: InvitationInfo
  isAuthenticated: boolean
  authenticatedEmail: string | null
}

export function InvitationPageClient({ token, invitation, isAuthenticated, authenticatedEmail }: Props) {
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const emailMismatch = isAuthenticated && authenticatedEmail && authenticatedEmail !== invitation.email

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!isAuthenticated) {
        // Sign up with the invited email
        const { error: signUpError } = await supabase.auth.signUp({
          email: invitation.email,
          password,
        })

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            // Already has an account — sign in instead
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: invitation.email,
              password,
            })
            if (signInError) {
              toast.error("Giriş yapılamadı. Şifrenizi kontrol edin.")
              return
            }
          } else {
            toast.error("Hesap oluşturulamadı. Lütfen tekrar deneyin.")
            return
          }
        }
      }

      // Accept the invitation via API
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || "Davet kabul edilemedi.")
        return
      }

      toast.success(`"${invitation.organizationName}" organizasyonuna katıldınız!`)
      router.push(`/${invitation.organizationSlug}/inbox`)
      router.refresh()
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <IconBuildingBank className="size-6" />
        </div>
        <CardTitle className="text-2xl">Davet Edildiniz</CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">{invitation.organizationName}</span> organizasyonuna{" "}
          <Badge variant="secondary" className="mx-1">
            {translateRole(invitation.roleName)}
          </Badge>{" "}
          olarak davet edildiniz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {emailMismatch ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Bu davet <strong>{invitation.email}</strong> adresine gönderilmiştir. Lütfen doğru hesapla giriş yapın.
          </div>
        ) : (
          <form onSubmit={handleAccept} className="space-y-6">
            <div className="rounded-2xl border bg-muted/50 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">{invitation.email}</strong> adresiyle katılıyorsunuz
            </div>

            {!isAuthenticated && (
              <div className="space-y-3">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Şifrenizi girin veya oluşturun"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Hesabınız yoksa şifre oluşturarak katılabilirsiniz.
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              disabled={!isAuthenticated && !password}
            >
              <IconCheck className="mr-2 size-4" />
              Daveti Kabul Et
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
