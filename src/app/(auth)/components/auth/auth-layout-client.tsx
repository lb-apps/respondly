"use client"

import { cn } from "@/lib/utils"
import { AUTH_STEPS } from "@/lib/auth-steps"
import { AnimatePresence, motion } from "framer-motion"
import { AuthLayoutProvider, useAuthLayout } from "@/contexts/auth-layout-context"
import { StepProgress } from "@/app/(auth)/components/auth/step-progress"
import { BrandingPanel } from "@/app/(auth)/components/auth/branding-panel"
import { Separator } from "@/components/ui/separator"
import { RespondlyLogo } from "@/components/respondly-logo"

const titleVariants = {
  enter: (custom: { direction: number; axis: "x" | "y" }) => ({
    [custom.axis]: custom.axis === "x"
      ? (custom.direction > 0 ? 24 : -24)
      : (custom.direction > 0 ? 14 : -14),
    opacity: 0,
    filter: "blur(6px)",
  }),
  center: {
    x: 0,
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
  },
  exit: (custom: { direction: number; axis: "x" | "y" }) => ({
    [custom.axis]: custom.axis === "x"
      ? (custom.direction > 0 ? -16 : 16)
      : (custom.direction > 0 ? -8 : 8),
    opacity: 0,
    filter: "blur(6px)",
  }),
}

const baseTiming = { duration: 0.42, ease: [0.25, 0.1, 0.25, 1] as const }
const titleTransition = { ...baseTiming, delay: 0.22 }
const subtitleTransition = { ...baseTiming, delay: 0.1 }

function AuthHeaderDisplay() {
  const { state } = useAuthLayout()

  const titleKey = `${state.title ?? ""}-${state.subtitle ?? ""}`
  const custom = { direction: state.direction, axis: state.slideAxis }

  return (
    <div className="flex shrink-0 flex-col gap-8">
      {/* Step progress */}
      <div
        className={cn(
          "transition-opacity duration-300",
          state.headerVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <StepProgress currentStep={state.currentStep} steps={AUTH_STEPS} />
      </div>

      {/* Title + subtitle */}
      {state.title && (
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout" custom={custom} initial={false}>
            <motion.div
              key={titleKey}
              className="flex flex-col gap-1"
            >
              <motion.h1
                custom={custom}
                variants={titleVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={titleTransition}
                className="text-2xl font-semibold tracking-tight text-foreground"
              >
                {state.title}
              </motion.h1>
              {state.subtitle && (
                <motion.p
                  custom={custom}
                  variants={titleVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={subtitleTransition}
                  className="text-base text-muted-foreground"
                >
                  {state.subtitle}
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>

          <Separator />
        </div>
      )}
    </div>
  )
}

function AuthFooterDisplay() {
  const { state } = useAuthLayout()

  return <div className="shrink-0">{state.footer}</div>
}

function ContextualBrandingPanel() {
  const { state } = useAuthLayout()
  return <BrandingPanel patternVariant={state.patternVariant} />
}

export function AuthLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayoutProvider>
      <div className="bg-background flex h-dvh w-full overflow-hidden">
        <div className="flex w-1/3 max-w-[560px] shrink-0 flex-col px-10 py-12">
          <div className="flex h-full flex-col gap-10">
            <RespondlyLogo className="h-8 shrink-0 lg:hidden" priority />
            <AuthHeaderDisplay />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            <AuthFooterDisplay />
          </div>
        </div>
        <ContextualBrandingPanel />
      </div>
    </AuthLayoutProvider>
  )
}
