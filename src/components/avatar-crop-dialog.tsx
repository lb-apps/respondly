"use client"

import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { IconMinus, IconPlus } from "@tabler/icons-react"

export interface AvatarCropDialogProps {
  imageSrc: string
  open: boolean
  onClose: () => void
  onCrop: (blob: Blob) => void
  /** Dialog heading. Required — the caller knows the context. */
  title: string
  outputSize?: number
  /**
   * Shape of the crop mask overlay.
   * - "circle"         – fully round (default, for user avatars)
   * - "rounded-square" – rounded rectangle (for org logos / square icons)
   */
  maskShape?: "circle" | "rounded-square"
  /**
   * Encoding of the cropped blob. Defaults to webp, which is the right choice
   * for anything we render ourselves. Pass jpeg when the bytes are destined for
   * a system that does not render webp — WhatsApp accepts a webp upload and
   * then silently fails to display it.
   */
  outputType?: "image/webp" | "image/jpeg"
}

interface Transform {
  x: number
  y: number
  scale: number
}

const CIRCLE_PADDING = 40
const MAX_SCALE = 4

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function AvatarCropDialog({
  imageSrc,
  open,
  onClose,
  onCrop,
  title,
  outputSize = 256,
  maskShape = "circle",
  outputType = "image/webp",
}: AvatarCropDialogProps) {
  const containerElRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 })
  // Tracks the naturalSize from the last time we applied the initial cover scale.
  // Used to distinguish "new image loaded" from "container resized".
  const prevNaturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  const [containerSize, setContainerSize] = useState(0)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  const circleRadius = Math.max(0, containerSize / 2 - CIRCLE_PADDING)
  const circleDiameter = circleRadius * 2

  const displayScale =
    containerSize > 0 && naturalSize.w > 0
      ? Math.min(containerSize / naturalSize.w, containerSize / naturalSize.h)
      : 1

  const baseW = naturalSize.w * displayScale
  const baseH = naturalSize.h * displayScale

  const minScale =
    containerSize > 0 && baseW > 0 && baseH > 0
      ? maskShape === "rounded-square"
        ? // Fit mode: entire image fits inside the square mask (no forced zoom-in)
          circleDiameter / Math.max(baseW, baseH)
        : // Cover mode: image always covers the full container (default for circle avatar)
          containerSize / Math.min(baseW, baseH)
      : 1


  const constrain = useCallback(
    (t: Transform): Transform => {
      const s = clamp(t.scale, minScale, MAX_SCALE)
      const scaledW = baseW * s
      const scaledH = baseH * s
      // Constrain to mask edges (not container edges) so the image can be
      // panned all the way to the top/bottom/left/right of the crop area.
      const maxX = Math.max(0, scaledW / 2 - circleRadius)
      const maxY = Math.max(0, scaledH / 2 - circleRadius)
      return {
        scale: s,
        x: clamp(t.x, -maxX, maxX),
        y: clamp(t.y, -maxY, maxY),
      }
    },
    [minScale, baseW, baseH, circleRadius],
  )

  // ---------- Measure container via ref callback ----------
  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    containerElRef.current = node
    if (node) {
      setContainerSize(node.clientWidth)
      const observer = new ResizeObserver(([entry]) => {
        setContainerSize(entry.contentRect.width)
      })
      observer.observe(node)
      observerRef.current = observer
    }
  }, [])

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  // ---------- Load image dimensions ----------
  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageSrc
  }, [imageSrc])

  // ---------- Set initial scale / re-constrain on layout change ----------
  // When naturalSize changes (new image) → reset position and apply cover scale.
  // When only containerSize changes (window resize) → re-constrain existing transform.
  useEffect(() => {
    if (containerSize === 0 || naturalSize.w === 0) return

    const isNewImage =
      naturalSize.w !== prevNaturalRef.current.w ||
      naturalSize.h !== prevNaturalRef.current.h

    if (isNewImage) {
      prevNaturalRef.current = naturalSize
      // Cover scale: shortest side of the image fills the mask (object-fit:cover on mask)
      const coverScale = circleDiameter / Math.min(baseW, baseH)
      const initialScale = clamp(coverScale, minScale, MAX_SCALE)
      setTransform({ x: 0, y: 0, scale: initialScale })
    } else {
      setTransform((prev) => constrain(prev))
    }
  }, [containerSize, naturalSize, constrain, circleDiameter, baseW, baseH, minScale])

  // ---------- Pointer pan ----------
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const target = e.target as HTMLElement
    target.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    }
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      setTransform((prev) =>
        constrain({ ...prev, x: drag.originX + dx, y: drag.originY + dy }),
      )
    },
    [constrain],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  // ---------- Wheel zoom ----------
  useEffect(() => {
    const el = containerElRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = 1 - e.deltaY * 0.002
      setTransform((prev) => constrain({ ...prev, scale: prev.scale * zoomFactor }))
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [constrain])

  // ---------- Slider zoom ----------
  const sliderValue = useMemo(() => {
    if (minScale >= MAX_SCALE) return 0
    return (transform.scale - minScale) / (MAX_SCALE - minScale)
  }, [transform.scale, minScale])

  const handleSliderChange = useCallback(
    (values: number[]) => {
      const newScale = minScale + values[0] * (MAX_SCALE - minScale)
      setTransform((prev) => constrain({ ...prev, scale: newScale }))
    },
    [minScale, constrain],
  )

  // ---------- Crop ----------
  const handleConfirm = async () => {
    const img = imgRef.current
    if (!img || !naturalSize.w) return
    setIsProcessing(true)
    try {
      const totalScale = displayScale * transform.scale

      const srcX = (-circleRadius - transform.x) / totalScale + naturalSize.w / 2
      const srcY = (-circleRadius - transform.y) / totalScale + naturalSize.h / 2
      const srcSize = circleDiameter / totalScale

      const canvas = document.createElement("canvas")
      canvas.width = outputSize
      canvas.height = outputSize
      const ctx = canvas.getContext("2d")!
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
          outputType,
          0.9,
        )
      })
      onCrop(blob)
    } finally {
      setIsProcessing(false)
    }
  }

  const scaledW = baseW * transform.scale
  const scaledH = baseH * transform.scale
  const ready = containerSize > 0 && naturalSize.w > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div
          ref={containerRefCallback}
          className="relative aspect-square w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-muted active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {ready && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: scaledW,
                  height: scaledH,
                  transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px))`,
                }}
              />
            </>
          )}

          {circleRadius > 0 && (
            <div
              className={`pointer-events-none absolute left-1/2 top-1/2 border-2 border-white/50 ${maskShape === "circle" ? "rounded-full" : "rounded-none"}`}
              style={{
                width: circleDiameter,
                height: circleDiameter,
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.2)",
              }}
            />
          )}
        </div>

        {/* Zoom controls — capsule pill */}
        <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Uzaklaştır"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() =>
              setTransform((prev) =>
                constrain({ ...prev, scale: Math.max(prev.scale - 0.25, minScale) }),
              )
            }
          >
            <IconMinus />
          </Button>
          <Slider
            min={0}
            max={1}
            step={0.005}
            value={[sliderValue]}
            onValueChange={handleSliderChange}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Yakınlaştır"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() =>
              setTransform((prev) =>
                constrain({ ...prev, scale: Math.min(prev.scale + 0.25, MAX_SCALE) }),
              )
            }
          >
            <IconPlus />
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Vazgeç
          </Button>
          <Button onClick={handleConfirm} loading={isProcessing}>
            Tamam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
