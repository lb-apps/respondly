"use client"

import { useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
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
import { ThreadView } from "@/components/chat/thread-view"
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
import { useMessageTimestamps } from "../use-message-timestamps"
import type { PreviewPersona } from "@/lib/supabase/queries/preview-personas"
import { PersonaPicker } from "./persona-picker"
import { PersonaBadge } from "./persona-badge"
import { PersonaEditorSheet } from "./persona-editor-sheet"
import { personaDisplayName, personaLanguageLabel } from "./persona-identity"
import { liveEventRow, livePreviewThreadRows, previewThreadRows } from "./thread-rows"
import type { ThreadRow } from "@/components/chat/thread-view"
import { formatPhoneDisplay } from "@/lib/phone"

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
  assistantId,
  personas: initialPersonas,
}: {
  slug: string
  organizationId: string
  assistantId: string | null
  personas: PreviewPersona[]
}) {
  const timeOf = useMessageTimestamps()
  const sessionIdRef = useRef<string | null>(null)
  const backfillDoneRef = useRef(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null)
  const [sheetSource, setSheetSource] = useState<SourceDetail | null>(null)
  const [highlightQuery, setHighlightQuery] = useState("")

  // Personas arrive from the server and only change when this page edits one,
  // so they live in state here rather than behind another round trip.
  const [personas, setPersonas] = useState(initialPersonas)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    initialPersonas[0]?.id ?? null
  )
  const [editingPersona, setEditingPersona] = useState<PreviewPersona | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const activePersona =
    personas.find((p) => p.id === selectedPersonaId) ?? null

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
    events,
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

  // A persona is locked into the session on the first message, so the picker
  // only decides anything while the thread is still empty.
  const canChat = !!assistantId && !!selectedPersonaId
  const viewingPast = viewingSessionId !== null

  // The thread the shared view draws. Events sit among the messages in time
  // order — they belong to the moment the assistant learned something, not to
  // the end of the conversation.
  const liveRows = useMemo(() => {
    const speaker = activePersona
      ? { name: personaDisplayName(activePersona), phone: activePersona.phone }
      : null
    return [
      ...livePreviewThreadRows(messages, speaker, timeOf),
      ...events
        .map((e) => liveEventRow(e))
        .filter((row): row is ThreadRow => row !== null),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [messages, activePersona, timeOf, events])

  const pastRows = useMemo(() => {
    const persona = pastThread?.session.persona
    return previewThreadRows(pastThread?.messages ?? [], {
      // A finished session shows the number it ran against; the name it may
      // have learned lives in the messages themselves.
      name: persona?.phone ? formatPhoneDisplay(persona.phone) : null,
      phone: persona?.phone ?? null,
    })
  }, [pastThread])

  function startNewSession() {
    syncSessionId(null)
    resetConversation()
    setViewingSessionId(null)
  }

  function handlePersonaSaved(saved: PreviewPersona) {
    setPersonas((prev) => {
      const known = prev.some((p) => p.id === saved.id)
      return known ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]
    })
    setSelectedPersonaId(saved.id)
  }

  function handlePersonaDeleted(personaId: string) {
    setPersonas((prev) => {
      const next = prev.filter((p) => p.id !== personaId)
      setSelectedPersonaId((current) =>
        current === personaId ? (next[0]?.id ?? null) : current
      )
      return next
    })
  }

  function openPersonaEditor(persona: PreviewPersona | null) {
    setEditingPersona(persona)
    setEditorOpen(true)
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
      const created = await createPreviewSessionAction({
        assistantId,
        organizationId,
        personaId: selectedPersonaId,
      })
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
        {/* One header, not two: the breadcrumb already names this page, so a
            title repeating it under its own rule was a band of chrome that said
            nothing and took height from the thread. */}
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

          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0 gap-1.5"
            onClick={startNewSession}
            disabled={!assistantId}
          >
            <Plus className="size-4" />
            Yeni Konuşma
          </Button>
        </header>

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
                <PersonaBadge
                  label={pastThread?.session.persona?.label ?? null}
                  name={
                    pastThread?.session.persona?.phone
                      ? formatPhoneDisplay(pastThread.session.persona.phone)
                      : null
                  }
                  phone={pastThread?.session.persona?.phone ?? null}
                />
                <ThreadView
                  rows={pastRows}
                  loading={threadLoading}
                  onSourceClick={handleSourceClick}
                  onConflictSourceClick={handleConflictSourceClick}
                />
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
                <PersonaBadge
                  label={activePersona?.label ?? null}
                  name={activePersona ? personaDisplayName(activePersona) : null}
                  phone={activePersona?.phone ?? null}
                  language={
                    activePersona ? personaLanguageLabel(activePersona) : null
                  }
                  onChange={messages.length > 0 ? startNewSession : undefined}
                />

                {messages.length === 0 ? (
                  <PersonaPicker
                    personas={personas}
                    selectedPersonaId={selectedPersonaId}
                    onSelect={setSelectedPersonaId}
                    onEdit={openPersonaEditor}
                    onCreate={() => openPersonaEditor(null)}
                  />
                ) : (
                  <ThreadView
                    rows={liveRows}
                    // The assistant answers from the left here, so that is where
                    // "yazıyor…" belongs.
                    typingSide={busy ? "start" : null}
                    onSourceClick={handleSourceClick}
                    onConflictSourceClick={handleConflictSourceClick}
                    onQuickReply={(label) => void handleSend({ text: label, files: [] })}
                    quickReplyDisabled={!canChat}
                  />
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

      <PersonaEditorSheet
        open={editorOpen}
        persona={editingPersona}
        organizationId={organizationId}
        onOpenChange={setEditorOpen}
        onSaved={handlePersonaSaved}
        onDeleted={handlePersonaDeleted}
      />

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
