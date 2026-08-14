"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { translateAuthError } from "@/lib/auth-errors"
import { AuthShell } from "@/app/(auth)/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useAuthLayout } from "@/contexts/auth-layout-context"
import { IconEye, IconEyeOff, IconArrowRight } from "@tabler/icons-react"

const bodyEnter = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.45, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
}

const LOGIN_EMAIL_KEY = "login_email"

export function LoginPageClient() {
  const [email, setEmail] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(sessionStorage.getItem(LOGIN_EMAIL_KEY) ?? "")
  }, [])

  const updateEmail = (v: string) => { setEmail(v); sessionStorage.setItem(LOGIN_EMAIL_KEY, v) }
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [isSendingReset, setIsSendingReset] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const { setHeader, setFooter } = useAuthLayout()

  const forgotFormRef = useRef<HTMLFormElement>(null)
  const loginFormRef = useRef<HTMLFormElement>(null)

  // Header: title + subtitle
  useEffect(() => {
    if (forgotMode) {
      setHeader({
        headerVisible: false,
        title: "Şifre sıfırlama",
        subtitle: "Sıfırlama bağlantısını e-postanıza göndereceğiz.",
      })
    } else {
      setHeader({
        headerVisible: false,
        title: "Tekrar hoş geldiniz",
        subtitle: "Hesabınıza giriş yaparak devam edin.",
      })
    }
  }, [forgotMode, setHeader])

  // Footer (shared)
  useEffect(() => {
    if (forgotMode) {
      setFooter(
        <div className="flex flex-col gap-5">
          <Button
            type="button"
            size="xl"
            className="w-full justify-between"
            loading={isSendingReset}
            disabled={!resetEmail.trim()}
            onClick={() => forgotFormRef.current?.requestSubmit()}
          >
            <span className="size-5" />
            <span className="flex-1 text-center">Bağlantı Gönder</span>
            <IconArrowRight />
          </Button>

          <p className="flex items-center justify-center gap-1 text-sm">
            <span className="text-muted-foreground">Şifrenizi hatırladınız mı?</span>
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => setForgotMode(false)}
            >
              Giriş yapın
            </button>
          </p>
        </div>
      )
      return
    }

    setFooter(
      <div className="flex flex-col gap-5">
        <Button
          type="button"
          size="xl"
          className="w-full justify-between"
          loading={isLoading}
          disabled={!email || !password}
          onClick={() => loginFormRef.current?.requestSubmit()}
        >
          <span className="size-5" />
          <span className="flex-1 text-center">Giriş yap</span>
          <IconArrowRight />
        </Button>

        <p className="flex items-center justify-center gap-1 text-sm">
          <span className="text-muted-foreground">Hesabınız yok mu?</span>
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Kayıt Olun
          </Link>
        </p>
      </div>
    )
  }, [setFooter, isLoading, email, password, forgotMode, isSendingReset, resetEmail])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setHeader({ title: null, subtitle: null, headerVisible: false })
      setFooter(null)
    }
  }, [setHeader, setFooter])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        toast.error(translateAuthError(error.message, "login"))
        return
      }

      sessionStorage.removeItem(LOGIN_EMAIL_KEY)
      router.push("/")
      router.refresh()
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail.trim()) return

    setIsSendingReset(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      )

      if (error) {
        toast.error("Şifre sıfırlama e-postası gönderilemedi. Lütfen tekrar deneyin.")
        return
      }

      toast.success("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.")
      setForgotMode(false)
      setResetEmail("")
    } catch {
      toast.error("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setIsSendingReset(false)
    }
  }

  return (
    <AuthShell>
      <motion.div
        key={forgotMode ? "forgot" : "login"}
        {...bodyEnter}
        className="flex flex-col gap-6"
      >
        {forgotMode ? (
          <form ref={forgotFormRef} onSubmit={handleForgotPassword} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Label htmlFor="resetEmail" className="text-sm font-medium text-foreground">E-posta</Label>
              <Input
                id="resetEmail"
                type="email"
                autoComplete="email"
                placeholder="ornek@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={isSendingReset}
                autoFocus
              />
            </div>
          </form>
        ) : (
          <form ref={loginFormRef} onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">E-posta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="ornek@email.com"
                value={email}
                  onChange={(e) => updateEmail(e.target.value)}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Şifre</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setForgotMode(true)}
                >
                  Şifremi unuttum
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((p) => !p)}
                >
                  {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                </button>
              </div>
            </div>
          </form>
        )}
      </motion.div>
    </AuthShell>
  )
}
