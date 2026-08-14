"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { MessageCircle, PlugZap } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConnectionForm, type ConnectionInitial } from "./connection-form"
import { WebhookCard } from "./webhook-card"
import { WhatsAppProfileForm } from "./profile-form"
import { MetaHealthCard } from "./meta-health-card"
import type { ProfileFormValues } from "./profile-schema"

interface Props {
  slug: string
  organizationId: string
  webhookUrl: string | null
  verifyToken: string
  initial: ConnectionInitial
  profile: ProfileFormValues
  profileSyncedAt: string | null
  profilePictureStoragePath: string | null
}

const STATUS_META: Record<
  string,
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  connected: { label: "Bağlı", variant: "secondary" },
  connecting: { label: "Bağlanıyor", variant: "outline" },
  disconnected: { label: "Bağlı değil", variant: "outline" },
  error: { label: "Hata", variant: "destructive" },
}

const TABS = { profile: "profil", connection: "baglanti" } as const
const TAB_PARAM = "sekme"

export function ChannelsClient({
  slug,
  organizationId,
  webhookUrl,
  verifyToken,
  initial,
  profile,
  profileSyncedAt,
  profilePictureStoragePath,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Derived during render rather than mirrored into state — the URL is the
  // single source of truth, so a deep link and a hard reload land on the same
  // tab with no effect to keep the two in sync.
  const requested = searchParams.get(TAB_PARAM)
  const tab = requested === TABS.connection ? TABS.connection : TABS.profile

  function selectTab(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set(TAB_PARAM, next)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const status = STATUS_META[initial.status] ?? STATUS_META.disconnected
  const connected = !!initial.id && initial.hasToken && !!initial.phoneNumberId

  return (
    <main className="mx-auto w-full max-w-3xl p-6 lg:p-10">
      <header className="mb-8 flex flex-col gap-1">
        <div className="text-muted-foreground flex items-center gap-2">
          <MessageCircle className="size-4" />
          <span className="text-sm font-medium">WhatsApp</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          {/* Outside the tabs on purpose: connection state must stay visible
              while the user is editing profile copy. */}
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">
          İşletmenin WhatsApp Cloud API numarasını bağla ve müşterilerin gördüğü
          profili buradan yönet.
        </p>
      </header>

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList className="mb-6">
          <TabsTrigger value={TABS.profile}>Profil</TabsTrigger>
          <TabsTrigger value={TABS.connection}>Bağlantı</TabsTrigger>
        </TabsList>

        <TabsContent value={TABS.profile} className="flex flex-col gap-6">
          {connected ? (
            <>
              <WhatsAppProfileForm
                slug={slug}
                channelId={initial.id!}
                organizationId={organizationId}
                initial={profile}
                syncedAt={profileSyncedAt}
                pictureStoragePath={profilePictureStoragePath}
              />
              <MetaHealthCard channelId={initial.id} hasToken={initial.hasToken} />
            </>
          ) : (
            <Alert>
              <PlugZap />
              <AlertTitle>Önce WhatsApp&apos;ı bağla</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                <span>
                  Profil bilgilerini Meta&apos;ya yazabilmek için Phone Number ID
                  ve erişim anahtarı gerekli.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectTab(TABS.connection)}
                >
                  Bağlantı ayarlarına git
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value={TABS.connection} className="flex flex-col gap-6">
          <ConnectionForm
            slug={slug}
            organizationId={organizationId}
            initial={initial}
          />
          {webhookUrl && (
            <WebhookCard webhookUrl={webhookUrl} verifyToken={verifyToken} />
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}
