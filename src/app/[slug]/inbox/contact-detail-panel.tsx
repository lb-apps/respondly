"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { MessageCircle, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import type { ContactDetail } from "@/lib/supabase/queries/contacts"
import {
  ContactField,
  ContactIdentityFields,
  contactIdentityDraftFrom,
  contactIdentityPatch,
} from "@/components/contacts/contact-identity-fields"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import {
  formatPhoneDisplay,
  getPhoneCountry,
  toWhatsAppHref,
} from "@/lib/phone"
import { updateContact } from "./actions"

const STATUS_LABEL: Record<string, string> = {
  bot: "Bot",
  needs_human: "Devir bekliyor",
  human: "Ekip",
  closed: "Kapalı",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

interface Props {
  detail: ContactDetail
  slug: string
  onClose?: () => void
}

/**
 * Unified contact profile panel: identity, contact fields, stats, and the
 * team's note — one editable surface. No distinction between staff-, system-,
 * and assistant-written data; it is one shared record. Parent remounts via
 * `key={contactId}` so drafts reset when switching conversations (no
 * Effect-based prop→state sync).
 *
 * The fields themselves live in `ContactIdentityFields`, shared with the
 * preview persona editor so the two forms cannot drift apart.
 */
export function ContactDetailPanel({ detail, slug, onClose }: Props) {
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState(() => contactIdentityDraftFrom(detail))

  const phoneDisplay = formatPhoneDisplay(detail.phone)
  const phoneCountry = getPhoneCountry(detail.phone)
  const waLink = toWhatsAppHref(detail.phone)
  const disabled = detail.contactId === null

  function save() {
    if (!detail.contactId) return

    startTransition(async () => {
      const res = await updateContact({
        contactId: detail.contactId!,
        // Which thread the change is announced in. A contact may have several,
        // and only the panel knows which one is open.
        conversationId: detail.conversation.id,
        slug,
        patch: contactIdentityPatch(draft),
      })
      if (res.ok) toast.success("Kişi bilgileri güncellendi")
      else toast.error("Hata", { description: res.error })
    })
  }

  return (
    <section className="flex h-full w-full flex-col">
      <header className="flex items-center gap-2 px-4 py-4">
        <h2 className="text-sm font-semibold tracking-tight">Kişi</h2>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-7"
            onClick={onClose}
            aria-label="Paneli kapat"
          >
            <X className="size-4" />
          </Button>
        )}
      </header>
      <Separator />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-7 p-5">
          {/* Identity */}
          <div className="flex flex-col items-center gap-2 text-center">
            <ContactAvatar size="xl" seed={detail.phone} />
            <div className="flex items-center gap-1.5 text-xs">
              {phoneCountry ? <span aria-hidden>{phoneCountry}</span> : null}
              <span className="text-muted-foreground">{phoneDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {STATUS_LABEL[detail.conversation.status] ?? detail.conversation.status}
              </Badge>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                <MessageCircle className="size-3" /> WhatsApp
              </a>
            </div>
          </div>

          {disabled && (
            <p className="text-muted-foreground rounded-xl border border-dashed p-3 text-center text-xs">
              Bu konuşmaya bağlı bir kişi kaydı yok, düzenlenemez.
            </p>
          )}

          <ContactIdentityFields
            value={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            disabled={disabled}
            countryPlaceholder={phoneCountry ?? "TR"}
            phoneField={
              <ContactField label="Telefon">
                <Input value={phoneDisplay} disabled readOnly />
              </ContactField>
            }
          />

          <Separator />

          {/* Stats (read-only) */}
          <dl className="text-muted-foreground grid grid-cols-2 gap-y-2 text-xs">
            <dt>Müşteri olalı</dt>
            <dd className="text-foreground text-right">{formatDate(detail.createdAt)}</dd>
            <dt>Son görülme</dt>
            <dd className="text-foreground text-right">{formatDate(detail.lastSeenAt)}</dd>
            <dt>Toplam konuşma</dt>
            <dd className="text-foreground text-right">{detail.totalConversations}</dd>
            <dt>Toplam mesaj</dt>
            <dd className="text-foreground text-right">{detail.totalMessages}</dd>
            <dt>Bu konuşma</dt>
            <dd className="text-foreground text-right">{detail.conversation.messageCount} mesaj</dd>
          </dl>
        </div>
      </ScrollArea>

      <Separator />
      <div className="p-4">
        <Button className="w-full" onClick={save} disabled={disabled || pending}>
          {pending ? <Spinner /> : "Kaydet"}
        </Button>
      </div>
    </section>
  )
}
