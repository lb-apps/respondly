"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { MessageCircle, Plus, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import type { ContactDetail } from "@/lib/supabase/queries/contacts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PREFERRED_LANGUAGE_LABELS } from "@/lib/contacts/identity"
import { GUEST_LOCALES, isGuestLocale } from "@/lib/i18n/guest-locale"

/** Sentinel: Radix Select forbids an empty-string item value. */
const NO_LANGUAGE = "__auto__"
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

/** "" → undefined; otherwise the trimmed string. */
function orUndef(v: string): string | undefined {
  const t = v.trim()
  return t ? t : undefined
}

/** Comma-separated text → clean string array (empty → undefined). */
function splitList(v: string): string[] | undefined {
  const items = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

function numOrUndef(v: string): number | undefined {
  const t = v.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

interface Props {
  detail: ContactDetail
  slug: string
  onClose?: () => void
}

/**
 * Unified contact profile panel: identity, contact fields, the evolving profile
 * (party/stay/preferences + freeform facts), stats, and a staff note — all in one
 * editable surface. No distinction between staff-, system-, and assistant-written
 * data; it is one shared record. Parent remounts via `key={contactId}` so drafts
 * reset when switching conversations (no Effect-based prop→state sync).
 */
export function ContactDetailPanel({ detail, slug, onClose }: Props) {
  const [pending, startTransition] = useTransition()

  const [firstName, setFirstName] = useState(detail.firstName ?? "")
  const [lastName, setLastName] = useState(detail.lastName ?? "")
  const [email, setEmail] = useState(detail.email ?? "")
  const [nationality, setNationality] = useState(detail.nationality ?? "")
  const [country, setCountry] = useState(detail.country ?? "")
  const [preferredLanguage, setPreferredLanguage] = useState(
    detail.preferredLanguage ?? ""
  )
  const [tags, setTags] = useState(detail.tags.join(", "))
  const [notes, setNotes] = useState(detail.notes ?? "")

  const phoneDisplay = formatPhoneDisplay(detail.phone)
  const phoneCountry = getPhoneCountry(detail.phone)
  const waLink = toWhatsAppHref(detail.phone)
  const disabled = detail.contactId === null

  function save() {
    if (!detail.contactId) return

    startTransition(async () => {
      const res = await updateContact({
        contactId: detail.contactId!,
        slug,
        patch: {
          firstName: orUndef(firstName) ?? null,
          lastName: orUndef(lastName) ?? null,
          email: orUndef(email) ?? null,
          nationality: orUndef(nationality)?.toUpperCase() ?? null,
          country: orUndef(country)?.toUpperCase() ?? null,
          preferredLanguage: isGuestLocale(preferredLanguage)
            ? preferredLanguage
            : null,
          tags: splitList(tags) ?? [],
          notes: orUndef(notes) ?? null,
        },
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

          {/* Identity */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ad">
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={disabled}
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Soyad">
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={disabled}
                  autoComplete="family-name"
                />
              </Field>
            </div>

            <Field label="Telefon">
              <Input value={phoneDisplay} disabled readOnly />
            </Field>

            <Field label="E-posta">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={disabled}
                placeholder="ornek@eposta.com"
                autoComplete="email"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Uyruk">
                <Input
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value.toUpperCase())}
                  disabled={disabled}
                  maxLength={2}
                  placeholder="TR"
                />
              </Field>
              <Field label="Ülke">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  disabled={disabled}
                  maxLength={2}
                  placeholder={phoneCountry ?? "TR"}
                />
              </Field>
            </div>

            <Field label="Tercih edilen dil">
              <Select
                value={preferredLanguage || NO_LANGUAGE}
                onValueChange={(value) =>
                  setPreferredLanguage(value === NO_LANGUAGE ? "" : value)
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Otomatik algıla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LANGUAGE}>Otomatik algıla</SelectItem>
                  {GUEST_LOCALES.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {PREFERRED_LANGUAGE_LABELS[locale]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Etiketler">
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={disabled}
                placeholder="VIP, tekrar eden, ..."
              />
            </Field>
          </div>

          <Separator />

          {/* Note */}
          <Field label="Not (yalnız ekip)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="Ekip için özel not…"
            />
          </Field>

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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
