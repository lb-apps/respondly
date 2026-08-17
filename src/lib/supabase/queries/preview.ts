import { createClient } from "@/lib/supabase/server"

/** How much of a session the preview holds — the most recent messages. */
export const PREVIEW_MESSAGE_LIMIT = 200

/**
 * Who a session ran against, for the history rail.
 *
 * `label` comes from the card and is null once it has been deleted; `phone`
 * comes from the session's own snapshot, so the avatar stays the same face
 * forever even then.
 */
export interface PreviewSessionPersona {
  label: string | null
  phone: string | null
}

export interface PreviewSessionListItem {
  id: string
  title: string | null
  lastMessageAt: string
  createdAt: string
  /** Null for sessions recorded before personas existed. */
  persona: PreviewSessionPersona | null
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
  /**
   * Same contract as `messages.metadata`: `{ event }` on a `system` row, empty
   * otherwise. Parsed by the caller with `parseThreadEvent`.
   */
  metadata: unknown
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
    .select(
      "id, title, last_message_at, created_at, persona_snapshot, assistant_preview_personas(label)"
    )
    .eq("assistant_id", assistantId)
    .order("last_message_at", { ascending: false })
    .limit(30)

  if (error || !data) return []

  return data.map((s) => ({
    id: s.id,
    title: s.title,
    lastMessageAt: s.last_message_at,
    createdAt: s.created_at,
    persona: toSessionPersona(s.persona_snapshot, s.assistant_preview_personas),
  }))
}

/** Card label (may be gone) + the snapshot's phone (never goes). */
function toSessionPersona(
  snapshot: unknown,
  card: { label: string } | { label: string }[] | null
): PreviewSessionPersona | null {
  const phone =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? ((snapshot as Record<string, unknown>).phone as string | undefined)
      : undefined
  const row = Array.isArray(card) ? card[0] : card
  const label = row?.label ?? null

  if (!phone && !label) return null
  return { label, phone: phone ?? null }
}

export async function getPreviewThread(sessionId: string): Promise<PreviewThread | null> {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from("assistant_preview_sessions")
    .select(
      "id, title, last_message_at, created_at, persona_snapshot, assistant_preview_personas(label)"
    )
    .eq("id", sessionId)
    .maybeSingle()

  if (!session) return null

  // Newest first, reversed below — an ascending order with a `limit` keeps the
  // OLDEST rows, freezing a long session on its opening messages.
  const { data: newestFirst } = await supabase
    .from("assistant_preview_messages")
    .select("id, role, body, parts, metadata, created_at")
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
      metadata: m.metadata,
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
      persona: toSessionPersona(
        session.persona_snapshot,
        session.assistant_preview_personas
      ),
    },
    messages: threadMessages,
  }
}
