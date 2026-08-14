"use client"

import { useEffect, useRef, useState } from "react"
import { Bot } from "lucide-react"
import type { UIMessage } from "ai"
import useSWR from "swr"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
} from "./preview-actions"
import { PreviewComposer } from "./preview-composer"
import { PreviewHistory } from "./preview-history"
import { usePreviewConversation } from "./use-preview-conversation"

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

export function PreviewSheet({
  open,
  onOpenChange,
  assistantId,
  organizationId,
  dirty,
  orgName,
  slug,
  firstMessage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assistantId: string | null
  organizationId: string
  dirty: boolean
  orgName: string
  slug: string
  firstMessage: string
}) {
  // See `preview-client`: in the preview the tester plays the guest, so the
  // guest side of the thread wears their own face.
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
    open && assistantId ? ["preview-sessions", assistantId] : null,
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

  useEffect(() => {
    bindSession(sessionIdRef.current)
  }, [assistantId, bindSession])

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
  const greeting = firstMessage.trim()
  const viewingPast = viewingSessionId !== null

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      syncSessionId(null)
      resetConversation()
      setViewingSessionId(null)
    }
    onOpenChange(nextOpen)
  }

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

    let activeSessionId = sessionIdRef.current
    if (!activeSessionId) {
      const created = await createPreviewSessionAction(assistantId, organizationId)
      if (!created.ok) {
        toast.error("Oturum açılamadı", { description: created.error })
        return
      }
      activeSessionId = created.sessionId
      syncSessionId(activeSessionId)
    }

    const attachmentIds: string[] = []
    const uiFileParts: unknown[] = []
    const supabase = createClient()

    for (const file of files) {
      const ext = fileExtOf(file.name)
      const path = `${organizationId}/${activeSessionId}/${crypto.randomUUID()}.${ext}`
      const mime = mimeForAttachment(file)
      const { error: upErr } = await supabase.storage
        .from(CHAT_ATTACHMENTS_BUCKET)
        .upload(path, file, { contentType: mime })
      if (upErr) {
        toast.error(`Yükleme başarısız: ${file.name}`, { description: upErr.message })
        continue
      }
      const att = await createPreviewAttachmentAction({
        sessionId: activeSessionId,
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
      sessionId: activeSessionId,
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

    syncSessionId(activeSessionId)

    appendUserMessage({
      id: saved.messageId,
      role: "user",
      parts: userParts as UIMessage["parts"],
    })

    // Wait TURN_DEBOUNCE_MS after the last message (WhatsApp parity), then reply.
    scheduleAssistantReply()
    void mutateSessions()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl lg:max-w-5xl"
        >
          <SheetHeader className="shrink-0 border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="size-4" />
                Önizleme
              </SheetTitle>
              {dirty && (
                <span className="text-muted-foreground ml-auto text-xs">
                  Kaydedilmemiş değişiklikler yansımaz
                </span>
              )}
            </div>
            <SheetDescription className="sr-only">
              Bir misafir gibi yaz ve asistanın yanıtını gör.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1">
            <PreviewHistory
              activeSessionId={activeSessionId}
              viewingSessionId={viewingSessionId}
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              onSelectSession={setViewingSessionId}
            />

            <div className="bg-background flex min-w-0 flex-1 flex-col">
              {viewingPast ? (
                <>
                  <div className="shrink-0 border-b px-5 py-2.5">
                    <p className="text-muted-foreground text-xs">
                      Geçmiş oturum
                      {pastThread?.session
                        ? ` · ${relativeTime(pastThread.session.lastMessageAt)}`
                        : ""}
                    </p>
                  </div>
                  <ThreadScroller>
                    {threadLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-16 w-3/4" />
                        <Skeleton className="ml-auto h-16 w-2/3" />
                      </div>
                    ) : (
                      <ThreadColumn className="min-w-0 gap-5">
                        {(pastThread?.messages ?? []).map((m) => {
                          const attViews: ChatAttachmentView[] = m.attachments.map(
                            (a) => ({
                              id: a.id,
                              kind: a.kind as "image" | "document",
                              filename: a.filename,
                              mimeType: a.mimeType,
                              signedUrl: a.signedUrl,
                            })
                          )
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
                </>
              ) : (
                <>
                  <ThreadScroller>
                    <ThreadColumn className="min-w-0 gap-5">
                      {greeting && (
                        <ChatMessageBubble role="assistant" text={greeting} />
                      )}
                      {messages.length === 0 ? (
                        <p className="text-muted-foreground py-12 text-center text-sm">
                          {orgName} asistanıyla konuşmaya başla. Fotoğraf veya PDF
                          ekleyebilirsin.
                        </p>
                      ) : (
                        (() => {
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
                        })()
                      )}
                      {busy && <ThreadTypingIndicator side="start" />}
                    </ThreadColumn>
                  </ThreadScroller>

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
        </SheetContent>
      </Sheet>

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
