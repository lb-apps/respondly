"use client"

import useSWR from "swr"
import { ExternalLink, RotateCw } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatPhoneDisplay } from "@/lib/phone"
import type { WhatsAppPhoneNumberInfo } from "@/lib/whatsapp/cloud-api/phone-number-info"
import { fetchWhatsAppHealth } from "./profile-actions"
import {
  CODE_VERIFICATION_LABELS,
  MESSAGING_TIER_LABELS,
  NAME_STATUS_LABELS,
  QUALITY_LABELS,
  QUALITY_VARIANTS,
} from "./profile-schema"

interface Props {
  channelId: string | null
  hasToken: boolean
}

const WHATSAPP_MANAGER_URL = "https://business.facebook.com/wa/manage/phone-numbers/"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

function value(raw: string | undefined, labels?: Record<string, string>): string {
  if (!raw) return "—"
  return labels?.[raw] ?? raw
}

function QualityBadge({ rating }: { rating: string | undefined }) {
  const key = rating ?? "UNKNOWN"
  const variant = QUALITY_VARIANTS[key]
  return variant ? (
    <Badge variant={variant}>{QUALITY_LABELS[key] ?? key}</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {QUALITY_LABELS.UNKNOWN}
    </Badge>
  )
}

function HealthRows({ info }: { info: WhatsAppPhoneNumberInfo }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Row label="Görünen ad">{value(info.verified_name)}</Row>
      {/* Raw numbers are never rendered — formatPhoneDisplay only. */}
      <Row label="Numara">{formatPhoneDisplay(info.display_phone_number)}</Row>
      <Row label="Kalite">
        <QualityBadge rating={info.quality_rating} />
      </Row>
      <Row label="Mesaj limiti">
        {value(info.messaging_limit_tier, MESSAGING_TIER_LABELS)}
      </Row>
      <Row label="Ad onayı">{value(info.name_status, NAME_STATUS_LABELS)}</Row>
      <Row label="Numara doğrulaması">
        {value(info.code_verification_status, CODE_VERIFICATION_LABELS)}
      </Row>
      <Row label="Resmî hesap">
        {info.is_official_business_account === undefined
          ? "—"
          : info.is_official_business_account
            ? "Evet"
            : "Hayır"}
      </Row>
    </dl>
  )
}

/**
 * Meta's own view of the number. Fetched client-side through SWR rather than in
 * the RSC: doing it server-side would put a Vault read and a Graph round-trip in
 * front of every render of this page, re-paid after every save, for a card
 * nobody reads twice.
 *
 * A null SWR key when there is no token means we make zero Graph calls for a
 * channel that cannot answer them.
 */
export function MetaHealthCard({ channelId, hasToken }: Props) {
  const { data, isLoading, mutate } = useSWR(
    channelId && hasToken ? ["wa-health", channelId] : null,
    () => fetchWhatsAppHealth({ channelId: channelId! }),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  if (!channelId || !hasToken) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta durumu</CardTitle>
        <CardDescription>
          Meta&apos;dan okunur, buradan değiştirilemez.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <dl className="grid gap-3 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </dl>
        ) : data?.ok ? (
          <HealthRows info={data.info} />
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              {data?.error ?? "Meta durumu alınamadı."}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Görünen adı değiştirmek Meta onayından geçer; WhatsApp Manager
            üzerinden yapılır.
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => mutate()}>
              <RotateCw className="size-4" />
              {data?.ok === false ? "Yeniden dene" : "Yenile"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={WHATSAPP_MANAGER_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                WhatsApp Manager&apos;da aç
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
