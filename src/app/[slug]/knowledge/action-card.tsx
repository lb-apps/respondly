"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Card-style action button used as a Dialog trigger (asChild). Icon on top,
 * label below, bordered card — matches the Knowledge action bar layout.
 * Forwards ref + props so Radix can wire open/close + a11y.
 */
export const ActionCard = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { icon: LucideIcon; label: string }
>(function ActionCard({ icon: Icon, label, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "flex w-36 flex-col gap-3 rounded-lg border border-border/70 bg-muted/25 p-4 text-left transition-colors hover:bg-muted aria-expanded:bg-muted data-[state=open]:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <Icon className="size-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
})
