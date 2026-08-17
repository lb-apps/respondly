"use client"

import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PREFERRED_LANGUAGE_LABELS } from "@/lib/contacts/identity"
import { GUEST_LOCALES, isGuestLocale } from "@/lib/i18n/guest-locale"

/**
 * The contact card's editable fields, in one place.
 *
 * Two surfaces edit the same person: the inbox panel and the preview persona
 * editor. They are the same record shape, so they are the same form — a second
 * hand-written copy would drift the moment a field is added.
 *
 * Presentational and fully controlled: the parent owns the draft and decides
 * what saving means.
 */

/** Draft state. All strings, because that is what inputs hold. */
export interface ContactIdentityDraft {
  firstName: string
  lastName: string
  email: string
  nationality: string
  country: string
  /** "" means nobody has established one yet. */
  preferredLanguage: string
  /** Comma-separated, as typed. */
  tags: string
  notes: string
}

export function contactIdentityDraftFrom(source: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  nationality?: string | null
  country?: string | null
  preferredLanguage?: string | null
  tags?: string[] | null
  notes?: string | null
}): ContactIdentityDraft {
  return {
    firstName: source.firstName ?? "",
    lastName: source.lastName ?? "",
    email: source.email ?? "",
    nationality: source.nationality ?? "",
    country: source.country ?? "",
    preferredLanguage: source.preferredLanguage ?? "",
    tags: (source.tags ?? []).join(", "),
    notes: source.notes ?? "",
  }
}

/** "" → null; otherwise the trimmed string. */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Draft → the shape every contact write takes. Empty fields clear the column. */
export function contactIdentityPatch(draft: ContactIdentityDraft) {
  return {
    firstName: orNull(draft.firstName),
    lastName: orNull(draft.lastName),
    email: orNull(draft.email),
    nationality: orNull(draft.nationality)?.toUpperCase() ?? null,
    country: orNull(draft.country)?.toUpperCase() ?? null,
    preferredLanguage: isGuestLocale(draft.preferredLanguage)
      ? draft.preferredLanguage
      : null,
    tags: draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    notes: orNull(draft.notes),
  }
}

interface Props {
  value: ContactIdentityDraft
  onChange: (patch: Partial<ContactIdentityDraft>) => void
  disabled?: boolean
  /** The phone row: read-only in the inbox, editable when defining a persona. */
  phoneField?: ReactNode
  /** Shown in the country input when nothing is set — usually the dialling code's guess. */
  countryPlaceholder?: string
}

export function ContactIdentityFields({
  value,
  onChange,
  disabled = false,
  phoneField,
  countryPlaceholder,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <ContactField label="Ad">
          <Input
            value={value.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            disabled={disabled}
            autoComplete="given-name"
          />
        </ContactField>
        <ContactField label="Soyad">
          <Input
            value={value.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            disabled={disabled}
            autoComplete="family-name"
          />
        </ContactField>
      </div>

      {phoneField}

      <ContactField label="E-posta">
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
          disabled={disabled}
          placeholder="ornek@eposta.com"
          autoComplete="email"
        />
      </ContactField>

      <div className="grid grid-cols-2 gap-4">
        <ContactField label="Uyruk">
          <Input
            value={value.nationality}
            onChange={(e) => onChange({ nationality: e.target.value.toUpperCase() })}
            disabled={disabled}
            maxLength={2}
            placeholder="TR"
          />
        </ContactField>
        <ContactField label="Ülke">
          <Input
            value={value.country}
            onChange={(e) => onChange({ country: e.target.value.toUpperCase() })}
            disabled={disabled}
            maxLength={2}
            placeholder={countryPlaceholder ?? "TR"}
          />
        </ContactField>
      </div>

      <ContactField
        label="Tercih edilen dil"
        hint="Müşteri yazdıkça asistan kendisi belirler."
      >
        {/* Languages only. "Otomatik algıla" used to sit at the top of this
            list as though it were a choice someone makes, and it never was:
            detection is not a mode, it is what happens whenever the customer
            writes something readable — a stored language never overrides the
            words in front of the assistant (see `resolveContactLocale`). An
            empty field is a fact about the card, not an option, so it is the
            placeholder rather than a row. */}
        <Select
          value={value.preferredLanguage || undefined}
          onValueChange={(next) => onChange({ preferredLanguage: next })}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Henüz belirlenmedi" />
          </SelectTrigger>
          <SelectContent>
            {GUEST_LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {PREFERRED_LANGUAGE_LABELS[locale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ContactField>

      <ContactField label="Etiketler">
        <Input
          value={value.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          disabled={disabled}
          placeholder="VIP, tekrar eden, ..."
        />
      </ContactField>

      <ContactField
        label="Not"
        hint="Ekip ve asistan görür, müşteriye gösterilmez."
      >
        <Textarea
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          disabled={disabled}
          rows={3}
          placeholder="Örn. Sadık müşterimiz, deniz manzaralı oda tercih ediyor."
        />
      </ContactField>
    </div>
  )
}

export function ContactField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}
