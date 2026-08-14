"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, Plug, PlugZap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { normalizePhoneE164 } from "@/lib/phone"
import { Spinner } from "@/components/ui/spinner"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { disconnectChannel, saveChannel, type ActionResult } from "./actions"

export interface ConnectionInitial {
  id: string | null
  phoneNumber: string
  phoneNumberId: string
  wabaId: string
  appId: string
  status: string
  hasToken: boolean
}

interface Props {
  slug: string
  organizationId: string
  initial: ConnectionInitial
}

/**
 * The Meta credentials card, unchanged in behaviour from when it lived in
 * `channels-client.tsx` — plain local state rather than react-hook-form,
 * because these are four independent identifiers with no cross-field rules.
 */
export function ConnectionForm({ slug, organizationId, initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber)
  const [phoneNumberId, setPhoneNumberId] = useState(initial.phoneNumberId)
  const [wabaId, setWabaId] = useState(initial.wabaId)
  const [appId, setAppId] = useState(initial.appId)
  const [accessToken, setAccessToken] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(!!initial.appId)

  function handleResult(res: ActionResult, successMsg: string) {
    if (!res.ok) {
      toast.error("Hata", { description: res.error })
      return
    }
    toast.success(successMsg)
    // Never keep a typed secret in memory after it has been stored.
    setAccessToken("")
    startTransition(() => router.refresh())
  }

  function submit() {
    startTransition(async () => {
      const res = await saveChannel({
        organizationId,
        channelId: initial.id,
        slug,
        phoneNumber: normalizePhoneE164(phoneNumber),
        phoneNumberId,
        wabaId: wabaId || undefined,
        appId: appId || undefined,
        accessToken: accessToken || undefined,
      })
      handleResult(res, "WhatsApp kanalı kaydedildi")
    })
  }

  function disconnect() {
    if (!initial.id) return
    startTransition(async () => {
      const res = await disconnectChannel({ channelId: initial.id!, slug })
      handleResult(res, "Kanal duraklatıldı")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta kimlik bilgileri</CardTitle>
        <CardDescription>
          Meta for Developers → WhatsApp → API Setup bölümünden alınır. Access
          token yalnızca sunucuda, şifreli saklanır.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">WhatsApp numarası</Label>
          <PhoneInput
            id="phone"
            defaultCountry="TR"
            value={phoneNumber || undefined}
            onChange={(value) => setPhoneNumber(value ?? "")}
            placeholder="+90 555 111 22 33"
          />
          <p className="text-muted-foreground text-xs">
            Görünen numara. Gönderim, aşağıdaki Phone Number ID üzerinden yapılır.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pnid">Phone Number ID</Label>
          <Input
            id="pnid"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="1234567890"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="waba">WhatsApp Business Account ID (opsiyonel)</Label>
          <Input
            id="waba"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="1234567890"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="token">Access Token</Label>
          <Input
            id="token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={
              initial.hasToken
                ? "•••••••• (değiştirmek için yeni token gir)"
                : "Kalıcı System User token"
            }
            autoComplete="off"
          />
          <p className="text-muted-foreground text-xs">
            {initial.hasToken
              ? "Kayıtlı bir token var. Boş bırakırsan değişmez."
              : "Token'da whatsapp_business_messaging ve whatsapp_business_management izinleri olmalı."}
          </p>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-3 w-fit">
              <ChevronDown
                className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
              />
              İleri düzey
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="appid">Meta Uygulama ID</Label>
              <Input
                id="appid"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1234567890123456"
                autoComplete="off"
              />
              <p className="text-muted-foreground text-xs">
                Profil fotoğrafı yüklemek için gerekir. Boş bırakırsan erişim
                anahtarından otomatik bulmayı deneriz.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center justify-end gap-2">
          {initial.id && initial.status !== "disconnected" && (
            <Button variant="ghost" onClick={disconnect} disabled={pending}>
              <Plug className="size-4" /> Duraklat
            </Button>
          )}
          <Button size="xl" onClick={submit} disabled={pending}>
            {pending ? <Spinner /> : <PlugZap className="size-4" />}
            {initial.id ? "Kaydet" : "Bağla"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
