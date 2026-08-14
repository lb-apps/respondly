"use client"

import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const MAX_WIDTH_CLASSES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  content: "sm:max-w-2xl md:max-w-3xl lg:max-w-4xl",
} as const

/** Bottom sheet: full-bleed on mobile; centered modal panel on md+. */
const BOTTOM_LAYOUT_CLASSES = {
  full: "h-dvh w-full max-w-full rounded-t-xl sm:max-w-full",
  constrained:
    "h-dvh w-full max-w-full rounded-t-xl sm:max-w-full md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:h-[min(96dvh,1000px)] md:w-[min(100%-1.5rem,72rem)] md:max-w-[72rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:shadow-xl",
} as const

interface AppSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /**
   * Sheet direction. `"right"` (default) is the standard side panel.
   * `"bottom"` opens a full-screen overlay from the bottom — suitable for
   * full-page forms that slide up over the current content.
   */
  side?: "right" | "bottom"
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES
  /** Only when `side="bottom"`. `constrained` shows a centered panel on desktop (not bottom-docked). */
  bottomLayout?: keyof typeof BOTTOM_LAYOUT_CLASSES
  footer?: React.ReactNode
  children: React.ReactNode
  /**
   * When true (default), the sheet body scrolls as a whole.
   * When false, the body is a flex column with `min-h-0` and no outer scroll so children
   * can use `flex-1` + internal overflow (e.g. tables with a sticky footer row).
   */
  scrollBody?: boolean
  /**
   * Extra class names applied to the body container div.
   * Useful to override default `px-4` padding (e.g. for two-column layouts).
   */
  bodyClassName?: string
}

export function AppSheet({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  maxWidth = "md",
  bottomLayout = "full",
  footer,
  children,
  scrollBody = true,
  bodyClassName,
}: AppSheetProps) {
  const isBottom = side === "bottom"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        overlayClassName="bg-black/20 backdrop-blur-[4px]"
        className={cn(
          "flex flex-col",
          isBottom
            ? BOTTOM_LAYOUT_CLASSES[bottomLayout]
            : MAX_WIDTH_CLASSES[maxWidth]
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className={cn(isBottom && "p-0 px-5 pt-3 md:px-6 md:pt-4 lg:px-8 lg:pt-5")}>
          <SheetTitle>{title}</SheetTitle>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col px-4",
            scrollBody ? "overflow-y-auto pb-4" : "overflow-hidden pb-0",
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer && (
          <SheetFooter className="flex-row justify-end">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
