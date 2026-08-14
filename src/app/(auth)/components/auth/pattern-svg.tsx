"use client"

import { motion, AnimatePresence } from "framer-motion"

export type PatternVariant = "circles" | "triangles" | "squares" | "hexagons"

interface PatternSVGProps {
  variant: PatternVariant
}

const S = "currentColor"
const SW = "0.5"
const CX = 350
const CY = 350
const DUR = 2.0

const EASE = "easeInOut" as const

const draw = {
  initial: { pathLength: 0, opacity: 0 },
  animate: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { delay: i * 0.12, duration: DUR, ease: EASE }, opacity: { delay: i * 0.12, duration: 0.4 } },
  }),
  exit: (i: number) => ({
    pathLength: 0,
    opacity: 0,
    transition: { pathLength: { delay: i * 0.06, duration: DUR * 0.6, ease: EASE }, opacity: { delay: i * 0.06 + DUR * 0.4, duration: 0.3 } },
  }),
}

function pts(r: number, n: number, offset = -90) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((offset + (360 * i) / n) * Math.PI) / 180
    return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`
  }).join(" ")
}

function spoke(r: number, n: number, offset = -90) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((offset + (360 * i) / n) * Math.PI) / 180
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
  })
}

function CirclesPattern() {
  const radii = [340, 260, 180, 100]
  return (
    <g opacity={0.15}>
      {radii.map((r, i) => (
        <motion.circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={S} strokeWidth={SW}
          variants={draw} custom={i} />
      ))}
      <motion.line x1={350} y1={10} x2={350} y2={690} stroke={S} strokeWidth={SW} variants={draw} custom={4} />
      <motion.line x1={10} y1={350} x2={690} y2={350} stroke={S} strokeWidth={SW} variants={draw} custom={5} />
      <motion.line x1={105} y1={105} x2={595} y2={595} stroke={S} strokeWidth={SW} variants={draw} custom={6} />
      <motion.line x1={595} y1={105} x2={105} y2={595} stroke={S} strokeWidth={SW} variants={draw} custom={7} />
    </g>
  )
}

function TrianglesPattern() {
  const radii = [320, 230, 145, 70]
  const tips = spoke(radii[0], 3)
  return (
    <g opacity={0.15}>
      {radii.map((r, i) => (
        <motion.polygon key={r} points={pts(r, 3)} fill="none" stroke={S} strokeWidth={SW}
          variants={draw} custom={i} />
      ))}
      {tips.map((t, i) => (
        <motion.line key={i} x1={CX} y1={CY} x2={t.x} y2={t.y} stroke={S} strokeWidth={SW}
          variants={draw} custom={4 + i} />
      ))}
    </g>
  )
}

function SquaresPattern() {
  const radii = [340, 260, 180, 100]
  return (
    <g opacity={0.15}>
      {radii.map((r, i) => (
        <motion.polygon key={r}
          points={`${CX - r},${CY - r} ${CX + r},${CY - r} ${CX + r},${CY + r} ${CX - r},${CY + r}`}
          fill="none" stroke={S} strokeWidth={SW} variants={draw} custom={i} />
      ))}
      <motion.line x1={350} y1={10} x2={350} y2={690} stroke={S} strokeWidth={SW} variants={draw} custom={4} />
      <motion.line x1={10} y1={350} x2={690} y2={350} stroke={S} strokeWidth={SW} variants={draw} custom={5} />
      <motion.line x1={10} y1={10} x2={690} y2={690} stroke={S} strokeWidth={SW} variants={draw} custom={6} />
      <motion.line x1={690} y1={10} x2={10} y2={690} stroke={S} strokeWidth={SW} variants={draw} custom={7} />
    </g>
  )
}

function HexagonsPattern() {
  const radii = [330, 245, 165, 88]
  const tips = spoke(radii[0], 6)
  return (
    <g opacity={0.15}>
      {radii.map((r, i) => (
        <motion.polygon key={r} points={pts(r, 6)} fill="none" stroke={S} strokeWidth={SW}
          variants={draw} custom={i} />
      ))}
      {tips.map((t, i) => (
        <motion.line key={i} x1={CX} y1={CY} x2={t.x} y2={t.y} stroke={S} strokeWidth={SW}
          variants={draw} custom={4 + i} />
      ))}
    </g>
  )
}

export function PatternSVG({ variant }: PatternSVGProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.svg
        key={variant}
        viewBox="0 0 700 700"
        className="text-foreground/15 size-full"
        initial="initial"
        animate="animate"
        exit="exit"
        fill="none"
      >
        {variant === "circles"   && <CirclesPattern />}
        {variant === "triangles" && <TrianglesPattern />}
        {variant === "squares"   && <SquaresPattern />}
        {variant === "hexagons"  && <HexagonsPattern />}
      </motion.svg>
    </AnimatePresence>
  )
}
