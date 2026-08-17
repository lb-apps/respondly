"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContactAvatar } from "@/components/inbox/contact-avatar"

/**
 * Who this conversation is with, above the thread.
 *
 * Rendered in both the live and the past-session view so the thread below keeps
 * the same geometry either way — a strip that appears in only one of them makes
 * the pane jump when a past session loads.
 *
 * Takes plain values rather than a persona: a finished session knows only what
 * its own snapshot kept, and the card it started from may be gone.
 */
export function PersonaBadge({
  label,
  name,
  phone,
  language,
  onChange,
}: {
  label: string | null
  /** Their own name, or their number when we never learned one. */
  name: string | null
  /** Seeds the avatar. Null only for sessions recorded before personas existed. */
  phone: string | null
  language?: string | null
  /** Absent in the past-session view: a finished run cannot change its person. */
  onChange?: () => void
}) {
  return (
    <div className="bg-background flex h-12 shrink-0 items-center gap-2.5 border-b px-6">
      {phone || label ? (
        <>
          {phone && <ContactAvatar size="sm" seed={phone} />}
          <span className="truncate text-sm font-medium">
            {label ?? "Silinmiş kişi"}
          </span>
          {name && (
            <span className="text-muted-foreground truncate text-xs">{name}</span>
          )}
          {language && (
            <Badge variant="secondary" className="font-normal">
              {language}
            </Badge>
          )}
        </>
      ) : (
        <span className="text-muted-foreground text-xs">Kişi kaydı yok</span>
      )}

      {onChange && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground ml-auto"
          onClick={onChange}
        >
          Değiştir
        </Button>
      )}
    </div>
  )
}
