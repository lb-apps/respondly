"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Check, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MODEL_OPTIONS, TONE_OPTIONS } from "@/mastra/models"
import { PromptMentionTextarea } from "@/components/assistant/prompt-mention-textarea"
import type { McpServerSummary } from "@/lib/mcp/types"
import {
  ALL_TIMEZONES,
  COMMON_TIMEZONES,
  formatZonedDate,
} from "@/lib/assistant/timezones"
import { saveAssistant } from "./actions"

const formSchema = z.object({
  name: z.string().trim().min(1, "İsim gerekli").max(80),
  tone: z.string().trim().min(1).max(80),
  systemPrompt: z.string().trim().max(4000),
  firstMessage: z.string().trim().max(300),
  model: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
})
type FormValues = z.infer<typeof formSchema>

interface AssistantClientProps {
  slug: string
  organizationId: string
  orgName: string
  /** Connected systems, so the prompt editor can complete their tool names. */
  mcpServers: McpServerSummary[]
  initial: {
    id: string | null
    name: string
    tone: string
    systemPrompt: string
    model: string
    firstMessage: string
    timezone: string
  }
}

export function AssistantClient({
  slug,
  organizationId,
  orgName,
  mcpServers,
  initial,
}: AssistantClientProps) {
  const [assistantId, setAssistantId] = useState<string | null>(initial.id)
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initial.name,
      tone: initial.tone,
      systemPrompt: initial.systemPrompt,
      firstMessage: initial.firstMessage,
      model: initial.model,
      timezone: initial.timezone,
    },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const res = await saveAssistant({
      organizationId,
      assistantId,
      slug,
      name: values.name,
      tone: values.tone || null,
      systemPrompt: values.systemPrompt || null,
      model: values.model,
      firstMessage: values.firstMessage || null,
      timezone: values.timezone,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error("Kaydedilemedi", { description: res.error })
      return
    }
    setAssistantId(res.assistantId)
    form.reset(values)
    toast.success("Asistan kaydedildi")
  }


  return (
    <div className="flex h-full flex-col">
      {/* Header strip: sidebar toggle + breadcrumb */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Asistan</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Ayarlar</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto"
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 px-6 pb-6 pt-8 lg:px-10">
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Asistan</h1>
            <p className="text-base text-muted-foreground">
              Misafir konuşmalarını yürüten asistanın kişilik ve davranış ayarları.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              {assistantId ? "Kaydet" : "Asistanı oluştur"}
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 gap-8 p-6 lg:grid-cols-[1fr_260px] lg:p-10">
          {/* Main editor */}
          <div className="flex flex-col gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asistan adı</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Örn. My Dora Hotel Asistanı" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="systemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kişilik ve talimatlar</FormLabel>
                  <InputGroup className="h-auto flex-col">
                    <FormControl>
                      <PromptMentionTextarea
                        rows={22}
                        placeholder="Örn. Sen Otel Mydora'nın resepsiyon asistanısın. Misafirlere oda tipleri, olanaklar ve konum hakkında yardımcı olursun. Bilmediğin bir şey sorulursa uydurmadan ekibe yönlendirirsin…"
                        className="min-h-[24rem]"
                        servers={mcpServers}
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <InputGroupAddon
                      align="block-end"
                      className="w-full justify-end border-t"
                    >
                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field: tzField }) => (
                          <TimezonePicker
                            value={tzField.value}
                            onChange={(tz) =>
                              tzField.onChange(tz)
                            }
                          />
                        )}
                      />
                    </InputGroupAddon>
                  </InputGroup>
                  <FormDescription>
                    Asistanın nasıl davranacağı. Boş bırakılırsa güvenli bir
                    varsayılan kullanılır.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="firstMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İlk mesaj</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder={`Merhaba, ${orgName}'e hoş geldiniz! Size nasıl yardımcı olabilirim?`}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Yeni bir konuşmayı açan karşılama mesajı. Boş bırakılırsa
                    asistan doğrudan soruya yanıt verir.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Settings rail */}
          <aside className="flex flex-col gap-6 lg:border-l lg:pl-8">
            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Üslup</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Üslup seç" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TONE_OPTIONS.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Model seç" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MODEL_OPTIONS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {MODEL_OPTIONS.find((m) => m.id === field.value)?.hint}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </aside>
        </div>
      </form>

    </Form>
    </div>
  )
}

/**
 * Searchable timezone picker for the prompt editor footer. The chosen zone is
 * the assistant's authoritative "today" (fed to `buildSystemPrompt`).
 *
 * Derives the visible list + date preview during render (no Effects) per
 * react-best-practices; popover content only mounts when open, so the
 * `new Date()` read is safe from hydration mismatch.
 */
function TimezonePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (timezone: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const trimmed = query.trim().toLowerCase()
  const results =
    trimmed === ""
      ? COMMON_TIMEZONES
      : ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(trimmed))
          .slice(0, 50)
          .map((id) => ({ id, label: id }))

  function select(tz: string) {
    onChange(tz)
    setQuery("")
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 bg-background px-2.5 text-sm font-normal shadow-sm"
        >
          <Globe className="size-4" />
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-96 p-0">
        <div className="space-y-0.5 px-3.5 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            Asistana iletilecek tarih
          </p>
          <p className="text-sm">
            {formatZonedDate(new Date(), value)}{" "}
            <span className="text-muted-foreground">({value})</span>
          </p>
        </div>
        <Separator />
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Saat dilimi ara…"
          />
          <CommandList>
            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
            <CommandGroup
              heading={trimmed === "" ? "Yaygın saat dilimleri" : "Sonuçlar"}
            >
              {results.map((tz) => (
                <CommandItem
                  key={tz.id}
                  value={tz.id}
                  onSelect={() => select(tz.id)}
                  className="py-2"
                >
                  <Check
                    className={cn(
                      "size-4",
                      tz.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{tz.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
