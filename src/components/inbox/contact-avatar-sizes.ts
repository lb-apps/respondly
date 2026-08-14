/**
 * `px` mirrors the Tailwind size on the same row, resolved against this app's
 * root scale (`html { font-size: 106.25% }` in globals.css, so 1rem = 17px).
 * Avvvatars sizes itself in pixels and derives its letter size from that
 * number, so it cannot read the class — the two must be kept in step by hand.
 * Change one, change the other.
 */
export const CONTACT_AVATAR_SIZES = {
  /** Message bubbles — a step under the header avatar: it marks who spoke,
   *  the bubble beside it is what is being read. */
  sm: {
    avatar: "size-7 [&_[data-slot=avatar-fallback]]:text-xs",
    px: 30,
    badge: { box: "size-[18px] rounded-[6px]", icon: 16 },
    channelOffset: {
      "bottom-left": "-bottom-1 -left-1",
      "bottom-right": "-bottom-1 -right-1",
    },
  },
  /** Conversation header */
  md: {
    avatar: "size-9 [&_[data-slot=avatar-fallback]]:text-sm",
    px: 38,
    badge: { box: "size-5 rounded-[6px]", icon: 17 },
    channelOffset: {
      "bottom-left": "-bottom-1 -left-1",
      "bottom-right": "-bottom-1 -right-1",
    },
  },
  /** Thread list */
  lg: {
    avatar: "size-10 [&_[data-slot=avatar-fallback]]:text-sm",
    px: 42,
    badge: { box: "size-6 rounded-[7px]", icon: 21 },
    channelOffset: {
      "bottom-left": "-bottom-1.5 -left-1.5",
      "bottom-right": "-bottom-1.5 -right-1.5",
    },
  },
  /** Contact card — the one place the avatar is the subject, not a marker. */
  xl: {
    avatar: "size-16 [&_[data-slot=avatar-fallback]]:text-base",
    px: 68,
    badge: { box: "size-7 rounded-lg", icon: 24 },
    channelOffset: {
      "bottom-left": "-bottom-1.5 -left-1.5",
      "bottom-right": "-bottom-1.5 -right-1.5",
    },
  },
} as const

export type ContactAvatarSize = keyof typeof CONTACT_AVATAR_SIZES

export type ChannelPlacement = keyof typeof CONTACT_AVATAR_SIZES.sm.channelOffset
