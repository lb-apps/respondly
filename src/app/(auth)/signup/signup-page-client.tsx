"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { AuthShell } from "@/app/(auth)/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { ProfileStep } from "@/app/(auth)/components/auth/steps/profile-step"
import { VerifyEmailStep } from "@/app/(auth)/components/auth/steps/verify-email-step"
import { OrganizationStep } from "@/app/(auth)/components/auth/steps/organization-step"
import { TeamInvitationStep } from "@/app/(auth)/components/auth/steps/team-invitation-step"
import { useAuthLayout } from "@/contexts/auth-layout-context"
import { IconArrowRight } from "@tabler/icons-react"
import type { ProfileStepHandle } from "@/app/(auth)/components/auth/steps/profile-step"
import type { VerifyEmailStepHandle } from "@/app/(auth)/components/auth/steps/verify-email-step"
import type { OrganizationStepHandle } from "@/app/(auth)/components/auth/steps/organization-step"
import type { TeamInvitationStepHandle } from "@/app/(auth)/components/auth/steps/team-invitation-step"

const STEPS = [
  { id: "profile", title: "Hesabınızı oluşturun", subtitle: "Profilinizi oluşturarak başlayın." },
  { id: "verification", title: "E-postanızı doğrulayın", subtitle: "" },
  { id: "organization", title: "İşletmenizi ekleyin", subtitle: "İşletmenizin temel bilgilerini girin." },
  { id: "team", title: "Ekibinizi davet edin", subtitle: "Ekibinizdeki kişıleri şimdiden ekleyin." },
]

const STEP_VARIANTS = ["circles", "triangles", "squares", "hexagons"] as const

const NEXT_LABELS: Record<number, string> = { 1: "Devam", 2: "Doğrula", 3: "Devam", 4: "Başlayalım" }

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
}

const mountAnimation = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.45, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
}

type StepHandle = ProfileStepHandle | VerifyEmailStepHandle | OrganizationStepHandle | TeamInvitationStepHandle

export function SignupPageClient() {
  const [currentStep, setCurrentStep] = useState(1)
  const [email, setEmail] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [orgId, setOrgId] = useState("")
  const [direction, setDirection] = useState(1)

  const [canProceed, setCanProceed] = useState(false)
  const [isStepLoading, setIsStepLoading] = useState(false)
  const stepRef = useRef<StepHandle>(null)
  const supabase = createClient()

  const { setHeader, setFooter } = useAuthLayout()
  const searchParams = useSearchParams()

  // Surface a failed magic-link exchange (expired/invalid) routed here by the
  // auth callback. One-shot toast on mount.
  useEffect(() => {
    if (searchParams.get("error") === "link_invalid") {
      toast.error("Bağlantı geçersiz veya süresi dolmuş. Kodu elle girin.")
    }
  }, [searchParams])

  // Dev-only: arrow keys to navigate steps freely
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "ArrowRight") {
        setDirection(1)
        setCurrentStep((s) => Math.min(s + 1, STEPS.length))
      } else if (e.key === "ArrowLeft") {
        setDirection(-1)
        setCurrentStep((s) => Math.max(s - 1, 1))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Sync header: step progress + title + subtitle
  useEffect(() => {
    if (currentStep < 1) return

    const step = STEPS[currentStep - 1]
    const resolvedEmail = email || sessionStorage.getItem("signup_email") || ""
    const subtitle =
      currentStep === 2
        ? `${resolvedEmail ? `${resolvedEmail} adresine` : "E-posta adresinize"} bir kod gönderdik.`
        : step.subtitle || null

    setHeader({
      currentStep,
      headerVisible: true,
      title: step.title,
      subtitle,
      direction,
      slideAxis: currentStep === 1 ? "y" : "x",
      patternVariant: STEP_VARIANTS[currentStep - 1],
    })
  }, [currentStep, direction, email, setHeader])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setHeader({ headerVisible: false, title: null, subtitle: null })
      setFooter(null)
    }
  }, [setHeader, setFooter])

  // Stable refs for footer callbacks
  const handleFooterNextRef = useRef<() => Promise<void>>(undefined)

  useEffect(() => {
    handleFooterNextRef.current = async () => {
      if (stepRef.current) {
        await stepRef.current.submit()
      }
    }
  })

  // Sync footer
  useEffect(() => {
    if (currentStep < 1) return

    const nextLabel = NEXT_LABELS[currentStep] ?? "Devam"

    setFooter(
      <div className="flex flex-col gap-5">
        <div>
          <Button
            type="button"
            size="xl"
            className="w-full justify-between"
            loading={isStepLoading}
            disabled={!canProceed}
            onClick={() => handleFooterNextRef.current?.()}
          >
            <span className="size-5" />
            <span className="flex-1 text-center">{nextLabel}</span>
            <IconArrowRight />
          </Button>
        </div>

        {/* Fixed-height anchor: step 1 content always in flow (invisible when inactive) */}
        <div className="relative flex flex-col gap-5">
          <div className={currentStep === 1 ? undefined : "invisible"}>
            <p className="flex items-center justify-center gap-1 text-sm">
              <span className="text-muted-foreground">Zaten hesabınız var mı?</span>
              <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
                Giriş yapın
              </Link>
            </p>
          </div>

          {/* Steps 2, 3 & 4: overlay on the same space */}
          {(currentStep === 2 || currentStep === 3) && (
            <div className="absolute inset-0 flex items-start justify-center">
              <p className="text-center text-xs text-muted-foreground">
                Kaydolarak{" "}
                <Link href="https://google.com" className="font-medium text-foreground underline underline-offset-2">
                  Kullanım Koşullarını
                </Link>
                {" "}ve{" "}
                <Link href="https://google.com" className="font-medium text-foreground underline underline-offset-2">
                  Gizlilik Politikasını
                </Link>
                <br />
                kabul etmiş olursunuz.
              </p>
            </div>
          )}


        </div>
      </div>
    )
  }, [currentStep, canProceed, isStepLoading, setFooter])

  // Poll step handle for canProceed / isLoading
  useEffect(() => {
    const interval = setInterval(() => {
      if (stepRef.current) {
        setCanProceed(stepRef.current.canProceed)
        setIsStepLoading(stepRef.current.isLoading)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [currentStep])

  // If user already has progress, silently jump to correct step
  useEffect(() => {
    async function detectStep() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        setEmail(user.email ?? "")

        if (!user.email_confirmed_at) {
          setCurrentStep(2)
          return
        }

        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id, organizations(slug)")
          .eq("user_id", user.id)
          .limit(1)
          .single()

        if (!membership) {
          setCurrentStep(3)
          return
        }

        const org = membership.organizations as { slug: string } | null
        if (org) {
          setOrgSlug(org.slug)
          setOrgId(membership.organization_id)
        }
        setCurrentStep(4)
      } catch {
        // Already on step 1, nothing to do
      }
    }

    detectStep()
  }, [supabase])

  const goToStep = useCallback(
    (step: number) => {
      setDirection(step > currentStep ? 1 : -1)
      setCurrentStep(step)
    },
    [currentStep]
  )

  const handleProfileNext = useCallback(
    (userEmail: string) => {
      setEmail(userEmail)
      goToStep(2)
    },
    [goToStep]
  )

  const handleVerifyNext = useCallback(() => {
    goToStep(3)
  }, [goToStep])

  const handleOrgNext = useCallback(
    (slug: string, id: string) => {
      setOrgSlug(slug)
      setOrgId(id)
      goToStep(4)
    },
    [goToStep]
  )

  return (
    <AuthShell>
      <motion.div {...mountAnimation} className="flex flex-1 flex-col">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-1 flex-col gap-8"
          >
            {currentStep === 1 && (
              <ProfileStep ref={stepRef as React.Ref<ProfileStepHandle>} onNext={handleProfileNext} />
            )}
            {currentStep === 2 && (
              <VerifyEmailStep ref={stepRef as React.Ref<VerifyEmailStepHandle>} email={email} onNext={handleVerifyNext} />
            )}
            {currentStep === 3 && (
              <OrganizationStep ref={stepRef as React.Ref<OrganizationStepHandle>} onNext={handleOrgNext} />
            )}
            {currentStep === 4 && (
              <TeamInvitationStep ref={stepRef as React.Ref<TeamInvitationStepHandle>} orgSlug={orgSlug} orgId={orgId} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AuthShell>
  )
}
