"use client"

import { Fragment } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface StepProgressProps {
  currentStep: number
  steps: Array<{ id: string; label: string }>
}

export function StepProgress({ currentStep, steps }: StepProgressProps) {
  return (
    <div className="flex w-full shrink-0 items-start">
      {steps.map((step, i) => {
        const stepNum = i + 1
        const isActive = stepNum === currentStep
        const isCompleted = stepNum < currentStep
        const isLast = i === steps.length - 1

        return (
          <Fragment key={step.id}>
            <div className="flex w-6 shrink-0 flex-col items-center">
              {/* Circle */}
              <div className="relative flex size-6 items-center justify-center">
                {/* Active pulse ring */}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      key="pulse"
                      className="absolute inset-0 rounded-full bg-foreground/10"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>

                <motion.div
                  className={cn(
                    "relative flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    (isActive || isCompleted) ? "bg-foreground text-background" : "border bg-background text-muted-foreground"
                  )}
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    backgroundColor: isActive || isCompleted ? "var(--foreground)" : "var(--background)",
                  }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <AnimatePresence mode="wait">
                    {isCompleted ? (
                      <motion.svg
                        key="check"
                        className="size-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.4 }}
                        transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
                      >
                        <motion.path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.28, delay: 0.1, ease: "easeOut" }}
                        />
                      </motion.svg>
                    ) : (
                      <motion.span
                        key="num"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                      >
                        {stepNum}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Label */}
              <motion.span
                className={cn(
                  "mt-2 whitespace-nowrap text-center text-xs font-medium leading-tight",
                  isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
                animate={{ opacity: isActive || isCompleted ? 1 : 0.5 }}
                transition={{ duration: 0.3 }}
              >
                {step.label}
              </motion.span>
            </div>

            {/* Connector */}
            {!isLast && (
              <div className="relative mx-1.5 mt-[11px] flex-1 overflow-hidden rounded-full">
                <div className="h-[1.5px] w-full bg-border" />
                <motion.div
                  className="absolute inset-y-0 left-0 h-[1.5px] bg-foreground/20"
                  initial={false}
                  animate={{ width: isCompleted ? "100%" : "0%" }}
                  transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
                />
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
