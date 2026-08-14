"use client"

import { useRef, useState } from "react"
import { MessageCircle, Plus } from "lucide-react"
import type { UIMessage } from "ai"
import useSWR from "swr"
import { toast } from "sonner"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble"
import { useUser } from "@/contexts/user-context"
import {
  ThreadColumn,
  ThreadScroller,
  ThreadTypingIndicator,
} from "@/components/chat/thread-surface"
import type { ChatAttachmentView } from "@/components/chat/chat-attachments"
import { createClient } from "@/lib/supabase/client"
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/assistant/attachments/constants"
import { fileExtOf, mimeForFileExt } from "@/lib/knowledge/file-upload"
import { getSourceDetailAction } from "@/app/[slug]/knowledge/actions"
import { SourceDetailSheet } from "@/app/[slug]/knowledge/source-detail-sheet"
import type { SourceDetail } from "@/lib/supabase/queries/knowledge"
import {
  createPreviewAttachmentAction,
  createPreviewSessionAction,
  generatePreviewSessionTitleAction,
  getPreviewSessionsAction,
  getPreviewThreadAction,
  savePreviewAssistantMessageAction,
} from "../preview-actions"
import { PreviewComposer } from "../preview-composer"
import { PreviewHistory } from "../preview-history"
import { usePreviewConversation } from "../use-preview-conversation"

function extractTextParts(parts: unknown[]): string {
  return parts
    .filter(
      (p): p is Record<string, unknown> =>
        typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "text"
    )
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n\n")
}

function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime()
  const diff = Date.now() - ts
  if (diff < 60_000) return "Az önce"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} dk`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} sa`
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(
    new Date(ts)
  )
}

function mimeForAttachment(file: File): string {
  const ext = fileExtOf(file.name)
  const imageMime: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }
  if (imageMime[ext]) return imageMime[ext]
  return mimeForFileExt(ext, file.type)
}

export function PreviewPageClient({
  slug,
  organizationId,
  orgName,
  assistantId,
}: {
  slug: string
  organizationId: string
  orgName: string
  assistantId: string | null
}) {
  // The tester's own identity: in the preview they are the one playing the
  // guest, so their messages carry their face, not a placeholder's.
  const { user } = useUser()
  const author = {
    name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || null,
    avatarUrl: user.avatar_url,
  }
  const sessionIdRef = useRef<string | null>(null)
  const backfillDoneRef = useRef(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null)
  const [sheetSource, setSheetSource] = useState<SourceDetail | null>(null)
  const [highlightQuery, setHighlightQuery] = useState("")

  const {
    data: sessions = [],
    mutate: mutateSessions,
    isLoading: sessionsLoading,
  } = useSWR(
    assistantId ? ["preview-sessions", assistantId] : null,
    () => getPreviewSessionsAction(assistantId!),
    {
      onSuccess(data) {
        if (backfillDoneRef.current) return
        const untitled = data.filter((s) => !s.title)
        if (untitled.length === 0) {
          backfillDoneRef.current = true
          return
        }
        backfillDoneRef.current = true
        for (const s of untitled) {
          void generatePreviewSessionTitleAction(s.id).then((res) => {
            if (res.ok) void mutateSessions()
          })
        }
      },
    }
  )

  const {
    messages,
    busy,
    stop,
    appendUserMessage,
    scheduleAssistantReply,
    resetConversation,
    bindSession,
  } = usePreviewConversation({
    assistantId,
    organizationId,
    sessionIdRef,
    onSessionsMutate: () => void mutateSessions(),
    onReplyError: () => toast.error("Asistan yanıt veremedi"),
  })

  function syncSessionId(id: string | null) {
    sessionIdRef.current = id
    setActiveSessionId(id)
    bindSession(id)
  }

  const { data: pastThread, isLoading: threadLoading } = useSWR(
    viewingSessionId ? ["preview-thread", viewingSessionId] : null,
    () => getPreviewThreadAction(viewingSessionId!)
  )

  const canChat = !!assistantId
  const viewingPast = viewingSessionId !== null

  function startNewSession() {
    syncSessionId(null)
    resetConversation()
    setViewingSessionId(null)
  }

  async function handleSourceClick(sourceId: string) {
    const detail = await getSourceDetailAction(sourceId)
    if (detail) {
      setHighlightQuery("")
      setSheetSource(detail)
    }
  }

  async function handleConflictSourceClick(sourceId: string, highlight: string) {
    const detail = await getSourceDetailAction(sourceId)
    if (detail) {
      setHighlightQuery(highlight.trim())
      setSheetSource(detail)
    }
  }

  async function handleSend({ text, files }: { text: string; files: File[] }) {
    if (!assistantId) return
    if (!text.trim() && files.length === 0) return

    let sid = sessionIdRef.current
    if (!sid) {
      const created = await createPreviewSessionAction(assistantId, organizationId)
      if (!created.ok) {
        toast.error("Oturum açılamadı", { description: created.error })
        return
      }
      sid = created.sessionId
      syncSessionId(sid)
    }

    const attachmentIds: string[] = []
    const uiFileParts: unknown[] = []
    const supabase = createClient()

    for (const file of files) {
      const ext = fileExtOf(file.name)
      const path = `${organizationId}/${sid}/${crypto.randomUUID()}.${ext}`
      const mime = mimeForAttachment(file)
      const { error: upErr } = await supabase.storage
        .from(CHAT_ATTACHMENTS_BUCKET)
        .upload(path, file, { contentType: mime })
      if (upErr) {
        toast.error(`Yükleme başarısız: ${file.name}`, { description: upErr.message })
        continue
      }
      const att = await createPreviewAttachmentAction({
        sessionId: sid,
        organizationId,
        storagePath: path,
        mimeType: mime,
        filename: file.name,
        sizeBytes: file.size,
      })
      if (!att.ok) {
        toast.error(`Ek kaydedilemedi: ${file.name}`, { description: att.error })
        continue
      }
      attachmentIds.push(att.id)
      uiFileParts.push({
        type: "file",
        mediaType: mime,
        filename: file.name,
        url: att.signedUrl ?? URL.createObjectURL(file),
      })
    }

    const body = text.trim()
    const userParts = [...(body ? [{ type: "text", text: body }] : []), ...uiFileParts]

    const saved = await savePreviewAssistantMessageAction({
      sessionId: sid,
      organizationId,
      role: "user",
      body,
      parts: userParts,
      attachmentIds,
    })
    if (!saved.ok) {
      toast.error("Mesaj kaydedilemedi", { description: saved.error })
      return
    }

    syncSessionId(sid)
    appendUserMessage({
      id: saved.messageId,
      role: "user",
      parts: userParts as UIMessage["parts"],
    })
    scheduleAssistantReply()
    void mutateSessions()
  }

  return (
    <>
      <div className="absolute inset-0 flex flex-col overflow-hidden">
        {/* Header strip */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Asistan</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Önizleme</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Title row */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight">Önizleme</h1>
            <p className="text-sm text-muted-foreground">
              {assistantId
                ? "Asistanı test et ve konuşmaları incele"
                : "Önce Ayarlar sayfasında asistan oluştur"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={startNewSession}
            disabled={!assistantId}
          >
            <Plus className="size-4" />
            Yeni Konuşma
          </Button>
        </div>

        {/* Body: two columns */}
        <div className="flex min-h-0 flex-1">
          <PreviewHistory
            activeSessionId={activeSessionId}
            viewingSessionId={viewingSessionId}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            onSelectSession={setViewingSessionId}
          />

          <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col">
            {viewingPast ? (
              <>
                <ThreadScroller>
                  {threadLoading ? (
                    <ThreadColumn className="gap-5">
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-14 w-3/4 rounded-2xl" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Skeleton className="h-4 w-12 rounded-full" />
                        <Skeleton className="h-10 w-2/3 rounded-2xl" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-20 w-4/5 rounded-2xl" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Skeleton className="h-4 w-12 rounded-full" />
                        <Skeleton className="h-10 w-1/2 rounded-2xl" />
                      </div>
                    </ThreadColumn>
                  ) : (
                    <ThreadColumn className="min-w-0 gap-5">
                      {(pastThread?.messages ?? []).map((m) => {
                        const attViews: ChatAttachmentView[] = m.attachments.map((a) => ({
                          id: a.id,
                          kind: a.kind as "image" | "document",
                          filename: a.filename,
                          mimeType: a.mimeType,
                          signedUrl: a.signedUrl,
                        }))
                        return (
                          <ChatMessageBubble
                            key={m.id}
                            role={m.role === "user" ? "user" : "assistant"}
                            text={m.body}
                            parts={m.parts ?? []}
                            attachments={attViews}
                            createdAt={m.createdAt}
                            author={author}
                            onSourceClick={handleSourceClick}
                            onConflictSourceClick={handleConflictSourceClick}
                          />
                        )
                      })}
                    </ThreadColumn>
                  )}
                </ThreadScroller>
                <div className="bg-background shrink-0 border-t px-6 py-2.5">
                  <p className="text-muted-foreground text-xs">
                    Geçmiş oturum
                    {pastThread?.session
                      ? ` · ${relativeTime(pastThread.session.lastMessageAt)}`
                      : ""}
                  </p>
                </div>
              </>
            ) : (
              <>
                {messages.length === 0 ? (
                  <div className="bg-sidebar flex min-h-0 flex-1 items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
                        <MessageCircle className="text-muted-foreground size-7" />
                      </div>
                      <p className="text-muted-foreground max-w-[200px] text-sm leading-relaxed">
                        Asistana mesaj göndererek konuşmayı başlat
                      </p>
                    </div>
                  </div>
                ) : (
                  <ThreadScroller>
                    <ThreadColumn className="min-w-0 gap-5">
                      {(() => {
                        return messages.map((m) => (
                          <ChatMessageBubble
                            key={m.id}
                            role={m.role}
                            text={extractTextParts(m.parts as unknown[])}
                            parts={m.parts as unknown[]}
                            author={author}
                            onSourceClick={handleSourceClick}
                            onConflictSourceClick={handleConflictSourceClick}
                            onQuickReplyClick={(label) =>
                              void handleSend({ text: label, files: [] })
                            }
                            quickReplyDisabled={!canChat}
                          />
                        ))
                      })()}
                      {busy && <ThreadTypingIndicator side="start" />}
                    </ThreadColumn>
                  </ThreadScroller>
                )}

                <PreviewComposer
                  canChat={canChat}
                  busy={busy}
                  onSend={handleSend}
                  onStop={stop}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <SourceDetailSheet
        source={sheetSource}
        open={sheetSource !== null}
        onOpenChange={(o) => {
          if (!o) {
            setSheetSource(null)
            setHighlightQuery("")
          }
        }}
        slug={slug}
        folders={[]}
        highlightQuery={highlightQuery}
        onChanged={() => {}}
      />
    </>
  )
}
