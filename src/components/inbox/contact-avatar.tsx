"use client"

import type { ReactNode } from "react"
import Avvvatars from "avvvatars-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChannelBadge } from "@/components/inbox/channel-badge"
import {
  CONTACT_AVATAR_SIZES,
  type ChannelPlacement,
  type ContactAvatarSize,
} from "@/components/inbox/contact-avatar-sizes"
import { cn } from "@/lib/utils"

type ContactAvatarProps = {
  variant?: "plain" | "with-channel"
  channelKind?: string | null
  channelPlacement?: ChannelPlacement
  size?: ContactAvatarSize
  className?: string
  fallbackClassName?: string
  /** Stable identity for the generated avatar — a contact or conversation id. */
  seed?: string
  /** A real photo, when we have one. Falls back to initials on load failure. */
  imageUrl?: string | null
  /** Accessible name for the photo; ignored when there is no photo. */
  imageAlt?: string
  children?: ReactNode
}

/**
 * One avatar, three sources in order of how much each says about the person:
 * their photo, an avatar generated from their id, or whatever the caller puts
 * inside it (the bot and headset glyphs on outbound messages).
 *
 * The generated one is `avvvatars` in its `shape` style: a stable string in, a
 * coloured disc with a geometric mark out. Same input, same avatar, forever —
 * so a contact keeps one face across sessions and devices with nothing stored
 * anywhere. Its palette is the library's own rather than the theme's; that is
 * the trade this makes.
 */
export function ContactAvatar({
  variant = "plain",
  channelKind,
  channelPlacement = "bottom-right",
  size = "md",
  className,
  fallbackClassName,
  seed,
  imageUrl,
  imageAlt,
  children,
}: ContactAvatarProps) {
  const sizeConfig = CONTACT_AVATAR_SIZES[size]
  const generated = !children && seed != null

  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar
        className={cn(
          sizeConfig.avatar,
          // shadcn's Avatar draws a hairline ring with an ::after overlay. It
          // reads as a border around a generated avatar, which already has its
          // own edge — the disc should sit on the page, not in a frame.
          generated && "after:hidden"
        )}
      >
        {imageUrl ? <AvatarImage src={imageUrl} alt={imageAlt ?? ""} /> : null}
        <AvatarFallback
          className={cn(
            "font-semibold",
            // A generated avatar draws its own disc and colour; the slot holding
            // it must not paint a second one underneath.
            generated ? "bg-transparent p-0" : "bg-muted text-muted-foreground",
            fallbackClassName
          )}
        >
          {generated ? (
            <Avvvatars value={seed} style="shape" size={sizeConfig.px} />
          ) : (
            children
          )}
        </AvatarFallback>
      </Avatar>
      {variant === "with-channel" && channelKind ? (
        <ChannelBadge
          kind={channelKind}
          size={size}
          className={cn("absolute", sizeConfig.channelOffset[channelPlacement])}
        />
      ) : null}
    </div>
  )
}
