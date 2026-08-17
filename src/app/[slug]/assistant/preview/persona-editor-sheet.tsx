"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ContactField,
  ContactIdentityFields,
  contactIdentityDraftFrom,
  contactIdentityPatch,
  type ContactIdentityDraft,
} from "@/components/contacts/contact-identity-fields"
import type { PreviewPersona } from "@/lib/supabase/queries/preview-personas"
import {
  createPreviewPersonaAction,
  deletePreviewPersonaAction,
  updatePreviewPersonaAction,
} from "./persona-actions"

/**
 * Create or edit a mock contact card.
 *
 * The body is the same `ContactIdentityFields` the inbox panel uses, so a
 * persona can only ever hold what a real contact holds. Two things are extra:
 * the card's own name, and an editable phone — a real contact's number comes
 * from WhatsApp and can never be typed.
 */

interface Draft {
  label: string
  phone: string
  identity: ContactIdentityDraft
}

function draftFrom(persona: PreviewPersona | null): Draft {
  return {
    label: persona?.label ?? "",
    phone: persona?.phone ?? "",
    identity: contactIdentityDraftFrom(persona ?? {}),
  }
}

export function PersonaEditorSheet({
  open,
  persona,
  organizationId,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  open: boolean
  /** Null when creating. */
  persona: PreviewPersona | null
  organizationId: string
  onOpenChange: (open: boolean) => void
  onSaved: (persona: PreviewPersona) => void
  onDeleted: (personaId: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-96 max-w-full gap-0 p-0 sm:max-w-sm">
        {/* Remounted per card so the draft resets without an Effect syncing
            props into state. */}
        <PersonaEditorBody
          key={persona?.id ?? "new"}
          persona={persona}
          organizationId={organizationId}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      </SheetContent>
    </Sheet>
  )
}

function PersonaEditorBody({
  persona,
  organizationId,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  persona: PreviewPersona | null
  organizationId: string
  onOpenChange: (open: boolean) => void
  onSaved: (persona: PreviewPersona) => void
  onDeleted: (personaId: string) => void
}) {
  const [draft, setDraft] = useState(() => draftFrom(persona))
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const fields = {
        label: draft.label,
        phone: draft.phone,
        ...contactIdentityPatch(draft.identity),
      }

      const res = persona
        ? await updatePreviewPersonaAction({
            personaId: persona.id,
            organizationId,
            fields,
          })
        : await createPreviewPersonaAction({ organizationId, fields })

      if (!res.ok) {
        toast.error("Kaydedilemedi", { description: res.error })
        return
      }
      toast.success(persona ? "Kişi kartı güncellendi" : "Kişi kartı eklendi")
      onSaved(res.value)
      onOpenChange(false)
    })
  }

  function remove() {
    if (!persona) return
    startTransition(async () => {
      const res = await deletePreviewPersonaAction({
        personaId: persona.id,
        organizationId,
      })
      if (!res.ok) {
        toast.error("Silinemedi", { description: res.error })
        return
      }
      toast.success("Kişi kartı silindi")
      onDeleted(persona.id)
      onOpenChange(false)
    })
  }

  return (
    <>
      <SheetHeader className="gap-1 px-5 py-4">
        <SheetTitle className="text-sm font-semibold">
          {persona ? "Kişi kartını düzenle" : "Yeni kişi kartı"}
        </SheetTitle>
        <SheetDescription className="text-xs leading-relaxed">
          Sadece önizleme için. Rehberdeki gerçek kişileri etkilemez.
        </SheetDescription>
      </SheetHeader>
      <Separator />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-5">
          <ContactField label="Kart adı" hint="Seçim ekranında görünür.">
            <Input
              value={draft.label}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="Örn. Sadık müşteri"
            />
          </ContactField>

          <ContactIdentityFields
            value={draft.identity}
            onChange={(patch) =>
              setDraft((prev) => ({
                ...prev,
                identity: { ...prev.identity, ...patch },
              }))
            }
            phoneField={
              <ContactField label="Telefon">
                <PhoneInput
                  value={draft.phone as never}
                  onChange={(value) =>
                    setDraft((prev) => ({ ...prev, phone: value ?? "" }))
                  }
                  defaultCountry="TR"
                />
              </ContactField>
            }
          />
        </div>
      </ScrollArea>

      <Separator />
      <div className="flex items-center gap-2 p-4">
        {persona && (
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            aria-label="Kişi kartını sil"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={pending}>
          {pending ? <Spinner /> : "Kaydet"}
        </Button>
      </div>
    </>
  )
}
