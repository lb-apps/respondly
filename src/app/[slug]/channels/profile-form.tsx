"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { RotateCw, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  PROFILE_ABOUT_MAX,
  PROFILE_ADDRESS_MAX,
  PROFILE_DESCRIPTION_MAX,
  PROFILE_EMAIL_MAX,
  WHATSAPP_VERTICALS,
} from "@/lib/whatsapp/cloud-api/business-profile-limits"
import { refreshWhatsAppProfile, saveWhatsAppProfile } from "./profile-actions"
import { ProfilePhotoField } from "./profile-photo-field"
import {
  VERTICAL_LABELS,
  profileFormSchema,
  type ProfileFormValues,
} from "./profile-schema"

interface Props {
  slug: string
  channelId: string
  organizationId: string
  initial: ProfileFormValues
  syncedAt: string | null
  pictureStoragePath: string | null
}

/**
 * Live character count for the fields Meta caps.
 *
 * Deliberately not `maxLength` on the input: silently swallowing keystrokes at
 * character 140 is worse than letting the value overshoot and showing both a
 * red count and a real message — especially when the text was pasted.
 *
 * Subscribes with `useWatch` rather than reading `form.watch()` in the parent,
 * so a keystroke re-renders this span instead of the whole form.
 */
function FieldCounter({
  control,
  name,
  max,
}: {
  control: Control<ProfileFormValues>
  name: "about" | "description" | "address" | "email"
  max: number
}) {
  const value = useWatch({ control, name })
  const length = value?.length ?? 0
  return (
    <span
      aria-live="polite"
      className={cn(
        "shrink-0 text-xs tabular-nums",
        length > max ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {length}/{max}
    </span>
  )
}

function formatSyncedAt(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function WhatsAppProfileForm({
  slug,
  channelId,
  organizationId,
  initial,
  syncedAt,
  pictureStoragePath,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [lastSyncedAt, setLastSyncedAt] = useState(syncedAt)
  // Only set by a refresh, and never persisted: Meta's picture url expires.
  const [metaPictureUrl, setMetaPictureUrl] = useState<string | null>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initial,
    // A deliberate departure from `../mcp/mcp-server-form.tsx`, which uses the
    // default onSubmit: these are long free-text fields where finding out at
    // submit time that you are six characters over is needless rework.
    mode: "onBlur",
    reValidateMode: "onChange",
  })

  function submit(values: ProfileFormValues) {
    startTransition(async () => {
      const res = await saveWhatsAppProfile({ ...values, channelId, slug })
      if (!res.ok) {
        // Leave the form dirty so nothing the user typed is lost.
        toast.error("Kaydedilemedi", { description: res.error })
        return
      }
      toast.success("Profil güncellendi", {
        description: "Değişiklikler WhatsApp'ta birkaç dakika içinde görünür.",
      })
      // Re-read rather than trusting the submitted values: the action mirrors
      // what Meta stored, and Meta normalises some of it.
      const fresh = await refreshWhatsAppProfile({ channelId, slug })
      if (fresh.ok) {
        form.reset(fresh.profile.values)
        setLastSyncedAt(fresh.profile.syncedAt)
        setMetaPictureUrl(fresh.profile.metaPictureUrl)
      } else {
        form.reset(values)
      }
    })
  }

  /**
   * Pull the profile back from Meta. An explicit button rather than a refresh
   * on mount: an automatic one would have to decide whether to overwrite what
   * the user is in the middle of typing, and the visible "Son eşitleme" stamp
   * already makes drift obvious without that risk.
   */
  function refresh() {
    startTransition(async () => {
      const res = await refreshWhatsAppProfile({ channelId, slug })
      if (!res.ok) {
        toast.error("Yenilenemedi", { description: res.error })
        return
      }
      form.reset(res.profile.values)
      setLastSyncedAt(res.profile.syncedAt)
      setMetaPictureUrl(res.profile.metaPictureUrl)
      toast.success("Meta'dan yenilendi")
    })
  }

  const syncedLabel = formatSyncedAt(lastSyncedAt)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
        <ProfilePhotoField
          slug={slug}
          channelId={channelId}
          organizationId={organizationId}
          storagePath={pictureStoragePath}
          metaPictureUrl={metaPictureUrl}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">İşletme bilgileri</CardTitle>
            <CardDescription>
              Müşteri profiline dokunduğunda WhatsApp&apos;ta bu bilgiler görünür.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="about"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hakkında</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Deniz manzaralı butik otel · 7/24 resepsiyon"
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-3">
                    <FormDescription>
                      Profilin en üstünde tek satır olarak görünür.
                    </FormDescription>
                    <FieldCounter control={form.control} name="about" max={PROFILE_ABOUT_MAX} />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      placeholder="İşletmeni birkaç cümleyle anlat."
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-3">
                    <FormDescription>
                      Profil sayfasında işletme bilgileri altında görünür.
                    </FormDescription>
                    <FieldCounter
                      control={form.control}
                      name="description"
                      max={PROFILE_DESCRIPTION_MAX}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vertical"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sektör</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WHATSAPP_VERTICALS.map((vertical) => (
                        <SelectItem key={vertical} value={vertical}>
                          {VERTICAL_LABELS[vertical]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Meta&apos;nın işletme kategorisi.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">İletişim</CardTitle>
            <CardDescription>
              WhatsApp profilinde tıklanabilir olarak görünür.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adres</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Kaleiçi Mah. Uzun Çarşı Sok. No:5, Muratpaşa/Antalya"
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-3">
                    <div />
                    <FieldCounter
                      control={form.control}
                      name="address"
                      max={PROFILE_ADDRESS_MAX}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      placeholder="rezervasyon@ornek.com"
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-3">
                    <div />
                    <FieldCounter control={form.control} name="email" max={PROFILE_EMAIL_MAX} />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="website1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Web sitesi</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="url"
                        placeholder="https://ornek.com"
                      />
                    </FormControl>
                    <FormDescription>
                      Meta en fazla iki adres kabul eder.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İkinci web sitesi</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="url"
                        placeholder="https://ornek.com/rezervasyon"
                      />
                    </FormControl>
                    <FormDescription>Opsiyonel.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1">
                {syncedLabel && (
                  <span className="text-muted-foreground text-xs">
                    Son eşitleme: {syncedLabel}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refresh}
                  disabled={pending}
                >
                  <RotateCw className="size-4" />
                  Yenile
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset()}
                  disabled={pending || !form.formState.isDirty}
                >
                  Vazgeç
                </Button>
                <Button type="submit" size="xl" disabled={pending}>
                  {pending ? <Spinner /> : <Save className="size-4" />}
                  Kaydet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
