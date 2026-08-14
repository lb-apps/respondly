import { SiInstagram } from "@icons-pack/react-simple-icons"
import type { IconType } from "@icons-pack/react-simple-icons"

import {
  CONTACT_AVATAR_SIZES,
  type ContactAvatarSize,
} from "@/components/inbox/contact-avatar-sizes"
import { cn } from "@/lib/utils"

type IconChannelDef = {
  label: string
  type: "icon"
  Logo: IconType
  iconClassName: string
}

type ImageChannelDef = {
  label: string
  type: "image"
  src: string
}

type ChannelDef = IconChannelDef | ImageChannelDef

const CHANNELS: Record<string, ChannelDef> = {
  whatsapp: {
    label: "WhatsApp",
    type: "image",
    src: "/icons/channels/whatsapp.png",
  },
  instagram: {
    label: "Instagram",
    type: "icon",
    Logo: SiInstagram,
    iconClassName: "text-chart-5",
  },
}

export function ChannelBadge({
  kind,
  size = "md",
  className,
}: {
  kind: string | null
  size?: ContactAvatarSize
  className?: string
}) {
  if (!kind) return null

  const channel = CHANNELS[kind]
  if (!channel) return null

  const { label } = channel
  const { box, icon } = CONTACT_AVATAR_SIZES[size].badge

  return (
    <span
      className={cn(
        "bg-background inline-flex shrink-0 items-center justify-center border border-border p-px select-none",
        box,
        className
      )}
      aria-hidden
    >
      {channel.type === "image" ? (
        <img
          src={channel.src}
          alt=""
          className="size-full object-contain"
          draggable={false}
        />
      ) : (
        <channel.Logo
          color="currentColor"
          size={icon}
          className={channel.iconClassName}
          title=""
          aria-hidden
        />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
