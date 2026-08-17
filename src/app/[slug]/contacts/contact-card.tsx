"use client"

import { memo } from "react"
import Link from "next/link"
import { MessageSquareText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import { formatDateTr } from "@/lib/format/datetime"
import { formatPhoneDisplay } from "@/lib/phone"
import type { ContactCard as ContactCardModel } from "@/lib/supabase/queries/contacts"
import { cn } from "@/lib/utils"

/**
 * One person, as a card.
 *
 * The shell is shared with the skeleton below rather than retyped, so a change
 * to padding or radius cannot move one without the other — see the skeleton
 * rule in CLAUDE.md.
 */
const CONTACT_CARD_SURFACE =
  "bg-card text-card-foreground flex flex-col overflow-hidden rounded-xl border"

/** The clickable body: everything above the footer. */
const CONTACT_CARD_BODY =
  "flex flex-1 flex-col items-center gap-2 px-4 pt-5 pb-4 text-center"

const CONTACT_CARD_FOOTER =
  "text-muted-foreground flex items-center justify-between gap-2 border-t px-3 py-2 text-xs"

/** How many tags fit before the rest become a count. */
const VISIBLE_TAGS = 2

interface Props {
  contact: ContactCardModel
  /** Where "Konuşmaya git" points. */
  slug: string
  onEdit: (contact: ContactCardModel) => void
}

function ContactCardImpl({ contact, slug, onEdit }: Props) {
  // A person we have never been told the name of is known by their number, so
  // the card leads with it rather than with a blank line.
  const phoneDisplay = formatPhoneDisplay(contact.phone)
  const displayName = contact.name?.trim() || phoneDisplay
  const named = Boolean(contact.name?.trim())

  const visibleTags = contact.tags.slice(0, VISIBLE_TAGS)
  const hiddenTagCount = contact.tags.length - visibleTags.length

  return (
    <article className={CONTACT_CARD_SURFACE}>
      <button
        type="button"
        onClick={() => onEdit(contact)}
        aria-label={`${displayName} kişisini düzenle`}
        className={cn(
          CONTACT_CARD_BODY,
          "hover:bg-accent/40 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none"
        )}
      >
        <ContactAvatar size="xl" seed={contact.phone} />

        <div className="flex w-full flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {/* The number repeats under the name only when the name is the name. */}
          <span className="text-muted-foreground truncate text-xs">
            {named ? phoneDisplay : "İsim henüz bilinmiyor"}
          </span>
        </div>

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="max-w-full truncate">
                {tag}
              </Badge>
            ))}
            {hiddenTagCount > 0 && (
              <Badge variant="outline">+{hiddenTagCount}</Badge>
            )}
          </div>
        )}

        <span className="text-muted-foreground mt-auto text-xs">
          Son görülme {formatDateTr(contact.lastSeenAt)}
        </span>
      </button>

      <div className={CONTACT_CARD_FOOTER}>
        <span>
          {contact.conversationCount > 0
            ? `${contact.conversationCount} konuşma`
            : "Konuşma yok"}
        </span>
        {contact.lastConversationId && (
          <Link
            href={`/${slug}/inbox?c=${contact.lastConversationId}`}
            className="text-foreground hover:text-primary inline-flex items-center gap-1 font-medium"
          >
            <MessageSquareText className="size-3.5" />
            Konuşmaya git
          </Link>
        )}
      </div>
    </article>
  )
}

/**
 * Memoized: search re-renders the whole grid on every settled keystroke, and a
 * card that came back identical has nothing to redraw. `onEdit` is stable in
 * the parent for the same reason.
 */
export const ContactCard = memo(ContactCardImpl)

/**
 * The same card with the person not yet in it.
 *
 * Built from the same shell constants and sized off the type scale (`h-[1lh]`
 * inside the element carrying the font), so the grid does not shift when the
 * real cards land.
 */
export function ContactCardSkeleton() {
  return (
    <div className={CONTACT_CARD_SURFACE} aria-hidden>
      <div className={CONTACT_CARD_BODY}>
        <Skeleton className="size-16 rounded-full" />
        {/* Same gap as the name block it stands in for — a 0.5 here is the
            2px the whole card drifts by. */}
        <div className="flex w-full flex-col gap-0.5">
          <span className="w-full text-sm">
            <Skeleton className="mx-auto h-[1lh] w-24" />
          </span>
          <span className="w-full text-xs">
            <Skeleton className="mx-auto h-[1lh] w-28" />
          </span>
        </div>
        <span className="mt-auto text-xs">
          <Skeleton className="h-[1lh] w-32" />
        </span>
      </div>
      <div className={CONTACT_CARD_FOOTER}>
        <Skeleton className="h-[1lh] w-16" />
        <Skeleton className="h-[1lh] w-24" />
      </div>
    </div>
  )
}
