"use client"

import { useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"
import type { CrawlConfig, CrawlMode } from "@/types/database"
import { FolderSelect } from "./folder-select"
import { ActionCard } from "./action-card"
import { createLinkSource } from "./actions"
import { LinkAutoToggles } from "./link-auto-toggles"

function deriveTitle(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "")
  } catch {
    return url
  }
}

function AnimatedModeFields({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <div
      aria-hidden={!active}
      inert={!active}
      className={cn(
        "grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,margin-top] duration-200 ease-out",
        active && "mt-4 grid-rows-[1fr] opacity-100"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <fieldset disabled={!active} className="contents">
          {children}
        </fieldset>
      </div>
    </div>
  )
}

export function AddUrlDialog({
  slug,
  organizationId,
  assistantId,
  defaultFolderId,
  folders,
  onDone,
}: {
  slug: string
  organizationId: string
  assistantId: string | null
  defaultFolderId: string | null
  folders: FolderOption[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CrawlMode>("single")
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId)
  const [url, setUrl] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [autoRemove, setAutoRemove] = useState(false)
  // whole-website only
  const [depth, setDepth] = useState("2")
  const [maxUrls, setMaxUrls] = useState("50")
  const [pattern, setPattern] = useState("")
  const [pending, startTransition] = useTransition()

  function reset() {
    setUrl("")
    setAutoRefresh(false)
    setAutoRemove(false)
    setDepth("2")
    setMaxUrls("50")
    setPattern("")
    setFolderId(defaultFolderId)
    setMode("single")
  }

  function submit() {
    const crawlConfig: CrawlConfig =
      mode === "single"
        ? { mode: "single" }
        : mode === "sitemap"
          ? {
              mode: "sitemap",
              maxUrls: Number(maxUrls) || 50,
              pattern: pattern.trim() || undefined,
            }
          : {
              mode: "whole",
              depth: Number(depth) || 2,
              maxUrls: Number(maxUrls) || 50,
              pattern: pattern.trim() || undefined,
            }

    startTransition(async () => {
      const res = await createLinkSource({
        organizationId,
        assistantId,
        slug,
        folderId,
        title: deriveTitle(url),
        url,
        crawlConfig,
        autoRefresh,
        autoRemove,
      })
      if (!res.ok) {
        toast.error("Hata", { description: res.error })
        return
      }
      toast.success("Bağlantı eklendi")
      reset()
      setOpen(false)
      onDone()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setFolderId(defaultFolderId)
      }}
    >
      <DialogTrigger asChild>
        <ActionCard icon={Globe} label="URL Ekle" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>URL Ekle</DialogTitle>
          <DialogDescription>
            Tek sayfa, site haritası veya tüm siteyi tara.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as CrawlMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="single" className="flex-1">
              Tek URL
            </TabsTrigger>
            <TabsTrigger value="sitemap" className="flex-1">
              Site Haritası
            </TabsTrigger>
            <TabsTrigger value="whole" className="flex-1">
              Tüm Site
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <div className="flex flex-col">
              <FolderSelect folders={folders} value={folderId} onChange={setFolderId} />
              <div className="mt-4 flex flex-col gap-2">
                <Label htmlFor="url-input">URL</Label>
                <Input
                  id="url-input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://otel.com"
                />
              </div>

              <AnimatedModeFields active={mode === "sitemap"}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sitemap-max">Maksimum URL</Label>
                    <Input
                      id="sitemap-max"
                      type="number"
                      min={1}
                      max={10000}
                      value={maxUrls}
                      onChange={(e) => setMaxUrls(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sitemap-pattern">Desen (isteğe bağlı)</Label>
                    <Input
                      id="sitemap-pattern"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder="*blog*"
                    />
                  </div>
                </div>
              </AnimatedModeFields>

              <AnimatedModeFields active={mode === "whole"}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Tarama derinliği</Label>
                    <ToggleGroup
                      type="single"
                      value={depth}
                      onValueChange={(v) => v && setDepth(v)}
                      variant="outline"
                      className="justify-start"
                    >
                      {["1", "2", "3", "4", "5"].map((d) => (
                        <ToggleGroupItem key={d} value={d} aria-label={`Derinlik ${d}`}>
                          {d}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="whole-max">Maksimum URL</Label>
                    <Input
                      id="whole-max"
                      type="number"
                      min={1}
                      max={10000}
                      value={maxUrls}
                      onChange={(e) => setMaxUrls(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="whole-pattern">Desen (isteğe bağlı)</Label>
                    <Input
                      id="whole-pattern"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder="*blog*"
                    />
                  </div>
                </div>
              </AnimatedModeFields>
            </div>

            <Separator className="my-8" />

            <LinkAutoToggles
              autoRefresh={autoRefresh}
              setAutoRefresh={setAutoRefresh}
              autoRemove={autoRemove}
              setAutoRemove={setAutoRemove}
              idPrefix="url"
            />
          </div>
        </Tabs>

        <DialogFooter>
          <Button onClick={submit} disabled={pending || !url.trim()}>
            {pending && <Spinner />} Ekle ve tara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
