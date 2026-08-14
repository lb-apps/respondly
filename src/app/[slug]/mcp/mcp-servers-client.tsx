"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, Plug, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import type { McpToolDescriptor } from "@/lib/mcp/types"
import { displayMcpUrl } from "@/lib/mcp/url"
import {
  deleteMcpServer,
  setMcpServerEnabled,
  testMcpServerConnection,
} from "./actions"
import { MCP_STATUS_LABELS, MCP_STATUS_VARIANTS } from "./schema"

export interface McpServerListView {
  id: string
  name: string
  slug: string
  url: string
  status: string
  error: string | null
  enabled: boolean
  toolsSyncedAt: string | null
  tools: McpToolDescriptor[]
}

function formatSyncedAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function McpServersClient({
  slug,
  servers,
}: {
  slug: string
  servers: McpServerListView[]
}) {
  if (servers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Plug />
          </EmptyMedia>
          <EmptyTitle>Henüz bağlı sunucu yok</EmptyTitle>
          <EmptyDescription>
            Kendi sisteminizi MCP sunucusu olarak bağlayın; asistan müsaitlik,
            fiyat, stok veya sipariş durumu gibi canlı bilgileri doğrudan oradan
            alsın.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={`/${slug}/mcp/new`}>
              <Plus className="size-4" /> Sunucu ekle
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ul className="space-y-4">
      {servers.map((server) => (
        <li key={server.id}>
          <McpServerCard slug={slug} server={server} />
        </li>
      ))}
    </ul>
  )
}

function McpServerCard({
  slug,
  server,
}: {
  slug: string
  server: McpServerListView
}) {
  const router = useRouter()
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const statusKey = server.enabled ? server.status : "disconnected"
  const syncedAt = formatSyncedAt(server.toolsSyncedAt)

  async function onTest() {
    setTesting(true)
    setTestMessage(null)
    const res = await testMcpServerConnection({ serverId: server.id, slugPath: slug })
    setTesting(false)

    if (!res.ok) {
      setTestMessage(res.error)
      toast.error("Bağlantı kurulamadı", { description: res.error })
      return
    }
    const message = `${res.tools.length} araç bulundu (${res.latencyMs} ms).`
    setTestMessage(message)
    toast.success("Bağlantı başarılı", { description: message })
    router.refresh()
  }

  function onToggle(enabled: boolean) {
    startTransition(async () => {
      const res = await setMcpServerEnabled({
        serverId: server.id,
        slugPath: slug,
        enabled,
      })
      if (!res.ok) {
        toast.error("Güncellenemedi", { description: res.error })
        return
      }
      router.refresh()
    })
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteMcpServer({ serverId: server.id, slugPath: slug })
      setConfirmDelete(false)
      if (!res.ok) {
        toast.error("Silinemedi", { description: res.error })
        return
      }
      toast.success("Sunucu silindi")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate">{server.name}</CardTitle>
              <Badge variant={MCP_STATUS_VARIANTS[statusKey] ?? "outline"}>
                {server.enabled
                  ? (MCP_STATUS_LABELS[server.status] ?? server.status)
                  : "Kapalı"}
              </Badge>
            </div>
            <CardDescription className="mt-1 truncate">
              <span title={server.url}>{displayMcpUrl(server.url)}</span> ·{" "}
              {server.tools.length} araç
              {syncedAt ? ` · son test ${syncedAt}` : ""}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={server.enabled}
              onCheckedChange={onToggle}
              disabled={pending}
              aria-label={`${server.name} sunucusunu ${server.enabled ? "kapat" : "aç"}`}
            />
            <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
              {testing ? <Spinner /> : <RefreshCw className="size-4" />}
              Bağlantıyı test et
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/${slug}/mcp/${server.id}`} aria-label={`${server.name} ayarları`}>
                <Settings2 className="size-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmDelete(true)}
              aria-label={`${server.name} sunucusunu sil`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p role="status" aria-live="polite" className="sr-only">
          {testing ? "Bağlantı test ediliyor" : (testMessage ?? "")}
        </p>

        {server.status === "error" && server.error ? (
          <p className="text-sm text-destructive">{server.error}</p>
        ) : null}

        {testMessage && server.status !== "error" ? (
          <p className="text-sm text-muted-foreground">{testMessage}</p>
        ) : null}

        {server.tools.length > 0 ? (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="-ml-2">
                <ChevronDown className="size-4" /> Araçları göster
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-2">
                {server.tools.map((tool) => (
                  <li key={tool.name} className="rounded-md border p-3">
                    <code className="text-xs font-medium">{tool.name}</code>
                    {tool.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-sm text-muted-foreground">
            Henüz araç keşfedilmedi. &quot;Bağlantıyı test et&quot; ile sunucunun
            araçlarını çekin.
          </p>
        )}
      </CardContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{server.name} silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bağlantı ve gizli anahtar kalıcı olarak silinir. Asistan bu
              sunucunun araçlarını bir daha kullanamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={pending}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
