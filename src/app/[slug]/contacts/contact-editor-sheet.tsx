"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import { formatPhoneDisplay, getPhoneCountry } from "@/lib/phone"
import type { ContactCard } from "@/lib/supabase/queries/contacts"
import { createContact, saveContact } from "./actions"

/**
 * Edit one person, or add one by hand.
 *
 * The body is the same `ContactIdentityFields` the inbox panel and the preview
 * persona editor use, so the three cannot hold different things. The only
 * difference between the two modes is the phone row: a real contact's number
 * comes from WhatsApp and is read-only, a hand-added one has to be typed.
 */

interface Props {
  open: boolean
  /** Null when adding. */
  contact: ContactCard | null
  organizationId: string
  slug: string
  onOpenChange: (open: boolean) => void
  onSaved: (contact: ContactCard) => void
}

export function ContactEditorSheet({
  open,
  contact,
  organizationId,
  slug,
  onOpenChange,
  onSaved,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-96 max-w-full gap-0 p-0 sm:max-w-sm">
        {/* Remounted per card, so the draft resets on switching without an
            Effect syncing props into state. */}
        <ContactEditorBody
          key={contact?.id ?? "new"}
          contact={contact}
          organizationId={organizationId}
          slug={slug}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </SheetContent>
    </Sheet>
  )
}

function ContactEditorBody({
  contact,
  organizationId,
  slug,
  onOpenChange,
  onSaved,
}: Omit<Props, "open">) {
  const [identity, setIdentity] = useState<ContactIdentityDraft>(() =>
    contactIdentityDraftFrom(contact ?? {})
  )
  const [phone, setPhone] = useState(contact?.phone ?? "")
  const [pending, startTransition] = useTransition()

  const phoneDisplay = formatPhoneDisplay(contact?.phone)
  const phoneCountry = getPhoneCountry(contact?.phone ?? phone)

  function save() {
    startTransition(async () => {
      const patch = contactIdentityPatch(identity)

      // Kept as two branches rather than one ternary: creating reports one
      // thing editing cannot (the number was already on file), and the two
      // results are different shapes because of it.
      if (contact) {
        const res = await saveContact({
          contactId: contact.id,
          organizationId,
          slug,
          patch,
        })
        if (!res.ok) {
          toast.error("Kaydedilemedi", { description: res.error })
          return
        }
        toast.success("Kişi güncellendi")
        onSaved(res.contact)
        onOpenChange(false)
        return
      }

      const res = await createContact({ organizationId, slug, phone, patch })
      if (!res.ok) {
        toast.error("Kaydedilemedi", { description: res.error })
        return
      }
      if (res.duplicate) {
        toast.info("Bu numara zaten kayıtlı", {
          description: "Mevcut kişi listede açıldı.",
        })
      } else {
        toast.success("Kişi eklendi")
      }
      onSaved(res.contact)
      onOpenChange(false)
    })
  }

  return (
    <>
      <SheetHeader className="gap-1 px-5 py-4">
        <SheetTitle className="text-sm font-semibold">
          {contact ? "Kişiyi düzenle" : "Yeni kişi"}
        </SheetTitle>
        <SheetDescription className="text-xs leading-relaxed">
          {contact
            ? "Ekip ve asistan aynı kartı görür."
            : "Henüz yazmamış birini şimdiden kaydedin. Yazdığında bu kartla eşleşir."}
        </SheetDescription>
      </SheetHeader>
      <Separator />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 p-5">
          {contact && (
            <div className="flex flex-col items-center gap-2 text-center">
              <ContactAvatar size="xl" seed={contact.phone} />
              <span className="text-muted-foreground text-xs">
                {contact.conversationCount > 0
                  ? `${contact.conversationCount} konuşma`
                  : "Henüz konuşma yok"}
              </span>
            </div>
          )}

          <ContactIdentityFields
            value={identity}
            onChange={(patch) => setIdentity((prev) => ({ ...prev, ...patch }))}
            disabled={pending}
            countryPlaceholder={phoneCountry ?? "TR"}
            phoneField={
              <ContactField
                label="Telefon"
                hint={
                  contact
                    ? "WhatsApp'tan gelir, değiştirilemez."
                    : undefined
                }
              >
                {contact ? (
                  <Input value={phoneDisplay} disabled readOnly />
                ) : (
                  <PhoneInput
                    value={phone as never}
                    onChange={(value) => setPhone(value ?? "")}
                    defaultCountry="TR"
                    disabled={pending}
                  />
                )}
              </ContactField>
            }
          />
        </div>
      </ScrollArea>

      <Separator />
      <div className="p-4">
        <Button
          className="w-full"
          onClick={save}
          disabled={pending || (!contact && phone.trim() === "")}
        >
          {pending ? <Spinner /> : "Kaydet"}
        </Button>
      </div>
    </>
  )
}
