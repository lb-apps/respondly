"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Props {
  webhookUrl: string
  verifyToken: string
}

/**
 * The two values that go into Meta's webhook configuration. Read-only and
 * app-level (Meta posts every event to one callback URL, not one per channel),
 * so this card owns nothing but its own copy-feedback state.
 */
export function WebhookCard({ webhookUrl, verifyToken }: Props) {
  const [copiedField, setCopiedField] = useState<"url" | "token" | null>(null)

  async function copyValue(value: string, field: "url" | "token", label: string) {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    toast.success(`${label} kopyalandı`)
    setTimeout(() => setCopiedField(null), 1500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Webhook yapılandırması</CardTitle>
        <CardDescription>
          Meta uygulaması → WhatsApp → Configuration bölümüne aşağıdaki geri
          çağırma adresini ve doğrulama anahtarını gir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Callback URL</Label>
          <div className="flex items-center gap-2">
            <code className="bg-muted min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-xs">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Callback URL kopyala"
              onClick={() => copyValue(webhookUrl, "url", "Callback URL")}
            >
              {copiedField === "url" ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Verify Token</Label>
          {verifyToken ? (
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-xs">
                {verifyToken}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Verify token kopyala"
                onClick={() => copyValue(verifyToken, "token", "Verify token")}
              >
                {copiedField === "token" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Sunucuda <code>WHATSAPP_VERIFY_TOKEN</code> tanımlı değil. Ortam
              değişkenini ayarla.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
