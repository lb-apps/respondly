"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { saveMcpServer } from "./actions"
import {
  MCP_AUTH_LABELS,
  MCP_TRANSPORT_LABELS,
  mcpServerFormSchema,
  type McpServerFormValues,
} from "./schema"

export interface McpServerFormInitial extends McpServerFormValues {
  id: string | null
  hasSecret: boolean
}

/** Turn a display name into a candidate tool namespace. */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
}

export function McpServerForm({
  slug,
  organizationId,
  initial,
}: {
  slug: string
  organizationId: string
  initial: McpServerFormInitial
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const isNew = initial.id === null

  const form = useForm<McpServerFormValues>({
    resolver: zodResolver(mcpServerFormSchema),
    defaultValues: initial,
  })

  const headers = useFieldArray({ control: form.control, name: "headers" })
  const queryParams = useFieldArray({
    control: form.control,
    name: "queryParams",
  })
  const authKind = form.watch("authKind")

  async function onSubmit(values: McpServerFormValues) {
    setSaving(true)
    const res = await saveMcpServer({
      ...values,
      organizationId,
      serverId: initial.id,
      slugPath: slug,
    })
    setSaving(false)

    if (!res.ok) {
      toast.error("Kaydedilemedi", { description: res.error })
      return
    }

    toast.success("Sunucu kaydedildi", {
      description: "Araçları görmek için bağlantıyı test edin.",
    })
    // Never keep a typed secret in memory after it has been stored.
    form.reset({ ...values, secret: "" })
    if (isNew) {
      router.replace(`/${slug}/mcp/${res.serverId}`)
    } else {
      router.refresh()
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ad</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Örn. My Dora Hotel Web Sitesi"
                    onChange={(event) => {
                      field.onChange(event)
                      // Only auto-fill the namespace while creating; changing it
                      // later would rename tools the model has already seen.
                      if (isNew && !form.formState.dirtyFields.slug) {
                        form.setValue("slug", slugifyName(event.target.value), {
                          shouldValidate: true,
                        })
                      }
                    }}
                  />
                </FormControl>
                <FormDescription>Panelde görünen isim.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anahtar</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="my_dora"
                    disabled={!isNew}
                    autoComplete="off"
                  />
                </FormControl>
                <FormDescription>
                  {isNew
                    ? "Araç adlarının önüne eklenir (örn. my_dora_search_availability)."
                    : "Araç adlarında kullanıldığı için sonradan değiştirilemez."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adres</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="url"
                  placeholder="https://ornek.com/api/mcp"
                />
              </FormControl>
              <FormDescription>
                Sunucunun MCP uç noktası. Yalnızca https adresleri kabul edilir.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="transport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aktarım</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(MCP_TRANSPORT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Modern sunucular Streamable HTTP kullanır.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timeoutMs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zaman aşımı (ms)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min={1000}
                    max={120000}
                    step={1000}
                    onChange={(event) =>
                      field.onChange(event.target.valueAsNumber)
                    }
                  />
                </FormControl>
                <FormDescription>
                  Bu süre içinde yanıt gelmezse istek iptal edilir.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="authKind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kimlik doğrulama</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(MCP_AUTH_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {authKind === "header" ? (
            <FormField
              control={form.control}
              name="authHeaderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık adı</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="X-Api-Key" autoComplete="off" />
                  </FormControl>
                  <FormDescription>
                    Gizli anahtarın gönderileceği HTTP başlığı.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>

        {authKind !== "none" ? (
          <FormField
            control={form.control}
            name="secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gizli anahtar</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="off"
                    placeholder={
                      initial.hasSecret
                        ? "Değiştirmek için yeni değer girin"
                        : "Örn. bearer token"
                    }
                  />
                </FormControl>
                <FormDescription>
                  {initial.hasSecret
                    ? "Kayıtlı. Boş bırakırsanız mevcut anahtar korunur."
                    : "Şifreli olarak saklanır ve bir daha gösterilmez."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <Separator />

        <KeyValueSection
          title="Sorgu parametreleri"
          description="Adrese eklenir. Değerlerde {{guestLocale}}, {{orgCurrency}} ve {{orgTimezone}} kullanabilirsiniz."
          rows={queryParams.fields}
          namePrefix="queryParams"
          form={form}
          onAdd={() =>
            queryParams.append({ key: "", value: "", appendToLinks: false })
          }
          onRemove={queryParams.remove}
          keyPlaceholder="locale"
          valuePlaceholder="{{guestLocale}}"
          linkToggle={{
            label: "Sitemize giden linklere de ekle",
            description:
              "İşaretli parametreler, asistanın sitenize yönlendirmek için gönderdiği linklerin sonuna eklenir. Bir aracın ürettiği ödeme/rezervasyon linkleri olduğu gibi gider.",
          }}
        />

        <KeyValueSection
          title="Ek başlıklar"
          description="Her istekte gönderilir. Gizli anahtarı buraya yazmayın."
          rows={headers.fields}
          namePrefix="headers"
          form={form}
          onAdd={() => headers.append({ key: "", value: "" })}
          onRemove={headers.remove}
          keyPlaceholder="X-Client"
          valuePlaceholder="respondly"
        />

        <Separator />

        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-6 rounded-lg border p-4">
              <div className="space-y-1">
                <FormLabel>Etkin</FormLabel>
                <FormDescription>
                  Kapalıyken asistan bu sunucunun araçlarını hiç görmez.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner /> : null}
            {isNew ? "Sunucu ekle" : "Kaydet"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/${slug}/mcp`)}
          >
            Vazgeç
          </Button>
        </div>
      </form>
    </Form>
  )
}

function KeyValueSection({
  title,
  description,
  rows,
  namePrefix,
  form,
  onAdd,
  onRemove,
  keyPlaceholder,
  valuePlaceholder,
  linkToggle,
}: {
  title: string
  description: string
  rows: Array<{ id: string }>
  namePrefix: "headers" | "queryParams"
  form: UseFormReturn<McpServerFormValues>
  onAdd: () => void
  onRemove: (index: number) => void
  keyPlaceholder: string
  valuePlaceholder: string
  /** Only query params travel on links; headers never do. */
  linkToggle?: { label: string; description: string }
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {linkToggle ? (
          <p className="text-sm text-muted-foreground">{linkToggle.description}</p>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.id} className="space-y-2">
              <div className="flex items-start gap-2">
              <FormField
                control={form.control}
                name={`${namePrefix}.${index}.key`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="sr-only">{title} — anahtar</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={keyPlaceholder} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`${namePrefix}.${index}.value`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="sr-only">{title} — değer</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={valuePlaceholder} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                aria-label={`${index + 1}. satırı sil`}
              >
                <Trash2 className="size-4" />
              </Button>
              </div>

              {linkToggle && namePrefix === "queryParams" ? (
                <FormField
                  control={form.control}
                  name={`queryParams.${index}.appendToLinks`}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 pl-1">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-muted-foreground text-xs font-normal">
                        {linkToggle.label}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus className="size-4" /> Satır ekle
      </Button>
    </section>
  )
}
