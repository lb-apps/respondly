"use client"

import { memo, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

const STICKY_TOP_PX = 8 // matches top-2

export const StickyDayHeading = memo(function StickyDayHeading({
  label,
}: {
  label: string
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const scrollRoot = sentinel.closest<HTMLElement>(
      "[data-slot=scroll-area-viewport]"
    )
    if (!scrollRoot) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      {
        root: scrollRoot,
        threshold: 0,
        rootMargin: `-${STICKY_TOP_PX}px 0px 0px 0px`,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div
        className={cn(
          "pointer-events-none sticky top-2 z-10 flex items-center",
          isStuck ? "justify-center" : "gap-3"
        )}
      >
        {!isStuck ? (
          <div className="bg-border/70 h-px min-w-0 flex-1" aria-hidden />
        ) : null}
        {/* A divider, not a heading: it says where you are while scrolling and
            must never read louder than the messages either side of it. */}
        <span className="bg-background/90 text-foreground/80 ring-border/60 pointer-events-auto shrink-0 rounded-full px-3 py-1 text-xs font-medium shadow-sm ring-1 backdrop-blur-sm">
          {label}
        </span>
        {!isStuck ? (
          <div className="bg-border/70 h-px min-w-0 flex-1" aria-hidden />
        ) : null}
      </div>
    </>
  )
})
