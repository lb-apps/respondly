"use client"

import { motion } from "framer-motion"
import { PatternSVG, type PatternVariant } from "@/app/(auth)/components/auth/pattern-svg"
import { TestimonialCarousel } from "@/app/(auth)/components/auth/testimonial-carousel"
import { RespondlyLogo } from "@/components/respondly-logo"

interface BrandingPanelProps {
  patternVariant?: PatternVariant
}

const blobs = [
  {
    // Warm light — top right
    style: {
      width: "55%",
      height: "55%",
      top: "-8%",
      right: "-8%",
      background:
        "radial-gradient(ellipse at 60% 40%, color-mix(in oklch, var(--foreground) 18%, transparent) 0%, color-mix(in oklch, var(--foreground) 5%, transparent) 50%, transparent 70%)",
    },
    animate: {
      scale: [1, 1.12, 1],
      x: [0, 30, 0],
      y: [0, -20, 0],
    },
    duration: 20,
  },
  {
    // Cool shadow — bottom left
    style: {
      width: "50%",
      height: "50%",
      bottom: "-6%",
      left: "-6%",
      background:
        "radial-gradient(ellipse at 40% 60%, color-mix(in oklch, var(--foreground) 20%, transparent) 0%, color-mix(in oklch, var(--foreground) 6%, transparent) 50%, transparent 70%)",
    },
    animate: {
      scale: [1, 1.15, 1],
      x: [0, -24, 0],
      y: [0, 24, 0],
    },
    duration: 25,
  },
  {
    // Warm mid — center left
    style: {
      width: "40%",
      height: "40%",
      top: "25%",
      left: "10%",
      background:
        "radial-gradient(ellipse at 50% 50%, color-mix(in oklch, var(--muted-foreground) 30%, transparent) 0%, color-mix(in oklch, var(--muted-foreground) 8%, transparent) 50%, transparent 70%)",
    },
    animate: {
      scale: [1, 1.18, 1],
      x: [0, 16, 0],
      y: [0, 14, 0],
    },
    duration: 28,
  },
  {
    // Light accent — bottom right
    style: {
      width: "35%",
      height: "35%",
      bottom: "15%",
      right: "5%",
      background:
        "radial-gradient(ellipse at 50% 50%, color-mix(in oklch, var(--muted-foreground) 22%, transparent) 0%, color-mix(in oklch, var(--muted-foreground) 6%, transparent) 50%, transparent 70%)",
    },
    animate: {
      scale: [1, 1.1, 1],
      x: [0, -18, 0],
      y: [0, -16, 0],
    },
    duration: 22,
  },
]

export function BrandingPanel({ patternVariant = "hexagons" }: BrandingPanelProps) {
  return (
    <div
      className="from-background via-muted to-secondary relative hidden min-w-0 flex-1 items-center justify-center overflow-hidden bg-gradient-to-br lg:flex"
    >
      {/* Subtle noise texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute will-change-transform"
          style={{ ...blob.style, filter: "blur(60px)" }}
          animate={blob.animate}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        />
      ))}

      {/* SVG pattern */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="aspect-square h-[85%]">
          <PatternSVG variant={patternVariant} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex max-w-[500px] flex-col gap-[72px]">
        <RespondlyLogo className="h-10" priority />

        <div className="flex flex-col gap-4">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
            WhatsApp&apos;ınız sizin için konuşsun.
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Misafir sorularını anında yanıtlayın, rezervasyona yönlendirin,
            gerektiğinde ekibinize devredin — hepsi tek bir gelen kutusunda.
          </p>
        </div>

        <TestimonialCarousel />
      </div>
    </div>
  )
}
