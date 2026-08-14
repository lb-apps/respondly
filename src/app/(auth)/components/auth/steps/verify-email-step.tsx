"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { translateAuthError } from "@/lib/auth-errors"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { toast } from "sonner"

export interface VerifyEmailStepHandle {
  submit: () => Promise<boolean>
  canProceed: boolean
  isLoading: boolean
}

interface VerifyEmailStepProps {
  email: string
  onNext: () => void
}

export const VerifyEmailStep = forwardRef<VerifyEmailStepHandle, VerifyEmailStepProps>(
  function VerifyEmailStep({ email, onNext }, ref) {
    const [otp, setOtp] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const supabase = createClient()

    const canProceed = otp.length === 6

    // Magic-link auto-continue. The confirmation email's link establishes a
    // session (in this tab or another). When that happens, advance the open
    // flow without making the user type the code. Sources we watch:
    //  - onAuthStateChange: fires on SIGNED_IN, including cross-tab broadcasts.
    //  - visibilitychange: covers the user tapping the link elsewhere then
    //    returning to this tab, where we re-check the confirmed session.
    const advancedRef = useRef(false)
    useEffect(() => {
      const advance = () => {
        if (advancedRef.current) return
        advancedRef.current = true
        onNext()
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.email_confirmed_at) advance()
      })

      const onVisible = async () => {
        if (document.visibilityState !== "visible") return
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.email_confirmed_at) advance()
      }
      document.addEventListener("visibilitychange", onVisible)

      return () => {
        sub.subscription.unsubscribe()
        document.removeEventListener("visibilitychange", onVisible)
      }
    }, [onNext, supabase.auth])

    const handleVerify = useCallback(
      async (token?: string): Promise<boolean> => {
        const code = token ?? otp
        if (code.length !== 6) return false

        setIsVerifying(true)
        try {
          const { error } = await supabase.auth.verifyOtp({
            email,
            token: code,
            type: "signup",
          })

          if (error) {
            toast.error(translateAuthError(error.message, "signup"))
            setOtp("")
            return false
          }

          // PKCE flow: session'ın cookie'ye yazılmasını bekle
          await supabase.auth.getSession()
          advancedRef.current = true
          onNext()
          return true
        } catch {
          toast.error("Doğrulama başarısız. Lütfen tekrar deneyin.")
          return false
        } finally {
          setIsVerifying(false)
        }
      },
      [email, otp, onNext, supabase.auth]
    )

    const handleResend = async () => {
      setIsResending(true)
      try {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
        })

        if (error) {
          toast.error(translateAuthError(error.message, "signup"))
          return
        }

        toast.success("Doğrulama kodu tekrar gönderildi.")
      } catch {
        toast.error("Kod gönderilemedi. Lütfen tekrar deneyin.")
      } finally {
        setIsResending(false)
      }
    }

    const handleChange = (value: string) => {
      setOtp(value)
      if (value.length === 6) {
        handleVerify(value)
      }
    }

    useImperativeHandle(ref, () => ({
      submit: () => handleVerify(),
      canProceed,
      isLoading: isVerifying,
    }), [handleVerify, canProceed, isVerifying])

    return (
      <>
        <div className="flex flex-col gap-6">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={handleChange}
            disabled={isVerifying}
            containerClassName="w-full"
            autoFocus
          >
            <InputOTPGroup className="w-full">
              <InputOTPSlot index={0} className="h-14 flex-1 text-lg" />
              <InputOTPSlot index={1} className="h-14 flex-1 text-lg" />
              <InputOTPSlot index={2} className="h-14 flex-1 text-lg" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup className="w-full">
              <InputOTPSlot index={3} className="h-14 flex-1 text-lg" />
              <InputOTPSlot index={4} className="h-14 flex-1 text-lg" />
              <InputOTPSlot index={5} className="h-14 flex-1 text-lg" />
            </InputOTPGroup>
          </InputOTP>

          <p className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Kod ulaşmadı mı?</span>
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2 disabled:opacity-50"
              onClick={handleResend}
              disabled={isResending}
            >
              Tekrar gönder
            </button>
          </p>
        </div>
      </>
    )
  }
)
