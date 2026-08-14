import Image from "next/image"

import {
  RESPONDLY_BRAND_NAME,
  RESPONDLY_ICON_PATH,
  RESPONDLY_LOGO_PATH,
} from "@/lib/brand/assets"
import { cn } from "@/lib/utils"

type RespondlyLogoProps = {
  variant?: "horizontal" | "icon"
  className?: string
  priority?: boolean
}

export function RespondlyLogo({
  variant = "horizontal",
  className,
  priority = false,
}: RespondlyLogoProps) {
  if (variant === "icon") {
    return (
      <Image
        src={RESPONDLY_ICON_PATH}
        alt={RESPONDLY_BRAND_NAME}
        width={32}
        height={32}
        unoptimized
        className={cn("size-8 shrink-0 object-contain", className)}
        priority={priority}
      />
    )
  }

  return (
    <Image
      src={RESPONDLY_LOGO_PATH}
      alt={RESPONDLY_BRAND_NAME}
      width={1799}
      height={874}
      unoptimized
      className={cn("h-8 w-auto max-w-full object-contain object-left", className)}
      priority={priority}
    />
  )
}
