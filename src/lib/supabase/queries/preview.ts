import { createClient } from "@/lib/supabase/server"

/** How much of a session the preview holds — the most recent messages. */
export const PREVIEW_MESSAGE_LIMIT = 200

export interface PreviewSessionListItem {
  id: string
  title: string | null
  lastMessageAt: string
  createdAt: string
}

export interface PreviewThreadAttachment {
  id: string
  kind: string
  mimeType: string
  filename: string
  signedUrl: string | null
  extractedText: string | null
}

export interface PreviewThreadMessage {
  id: string
  role: string
  body: string
  parts: unknown[] | null
  createdAt: string
  attachments: PreviewThreadAttachment[]
}

export interface PreviewThread {
  session: PreviewSessionListItem
  messages: PreviewThreadMessage[]
}

export async function listPreviewSessions(
  assistantId: string
): Promise<PreviewSessionListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("assistant_preview_sessions")
    .select("id, title, last_message_at, created_at")
    .eq("assistant_id", assistantId)
    .order("last_message_at", { ascending: false })
    .limit(30)

  if (error || !data) return []

  return data.map((s) => ({
    id: s.id,
    title: s.title,
    lastMessageAt: s.last_message_at,
    createdAt: s.created_at,
  }))
}

export async function getPreviewThread(sessionId: string): Promise<PreviewThread | null> {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from("assistant_preview_sessions")
    .select("id, title, last_message_at, created_at")
    .eq("id", sessionId)
    .maybeSingle()

  if (!session) return null

  // Newest first, reversed below — an ascending order with a `limit` keeps the
  // OLDEST rows, freezing a long session on its opening messages.
  const { data: newestFirst } = await supabase
    .from("assistant_preview_messages")
    .select("id, role, body, parts, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PREVIEW_MESSAGE_LIMIT)

  const messages = [...(newestFirst ?? [])].reverse()

  const { data: attachments } = await supabase
    .from("assistant_preview_attachments")
    .select("id, message_id, kind, mime_type, filename, storage_path, extracted_text")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  const attByMessage = new Map<string, typeof attachments>()
  for (const att of attachments ?? []) {
    if (!att.message_id) continue
    const list = attByMessage.get(att.message_id) ?? []
    list.push(att)
    attByMessage.set(att.message_id, list)
  }

  const threadMessages: PreviewThreadMessage[] = []

  for (const m of messages) {
    const msgAtts = attByMessage.get(m.id) ?? []
    const signedAtts: PreviewThreadAttachment[] = []

    for (const a of msgAtts) {
      let signedUrl: string | null = null
      if (a.kind === "image") {
        const { data: signed } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(a.storage_path, 3600)
        signedUrl = signed?.signedUrl ?? null
      }
      signedAtts.push({
        id: a.id,
        kind: a.kind,
        mimeType: a.mime_type,
        filename: a.filename,
        signedUrl,
        extractedText: a.extracted_text,
      })
    }

    threadMessages.push({
      id: m.id,
      role: m.role,
      body: m.body,
      parts: Array.isArray(m.parts) ? (m.parts as unknown[]) : null,
      createdAt: m.created_at,
      attachments: signedAtts,
    })
  }

  return {
    session: {
      id: session.id,
      title: session.title,
      lastMessageAt: session.last_message_at,
      createdAt: session.created_at,
    },
    messages: threadMessages,
  }
}
