import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/database"
import { signAttachmentUrl } from "@/lib/assistant/attachments/sign"
import type { ChatAttachmentRecord } from "@/lib/assistant/attachments/types"
import type { ContactProfile } from "@/lib/contacts/profile-store"
import { getPreviewPersona } from "@/lib/supabase/queries/preview-personas"

type DB = SupabaseClient<Database>

export type PreviewUIMessage = {
  id: string
  role: "user" | "assistant"
  parts: unknown[]
}

/**
 * Open a session, taking the persona's snapshot as it stands right now.
 *
 * The copy is the point: the assistant reads and writes the snapshot for the
 * rest of the run, so it can learn a name mid-conversation without the card the
 * staff defined ever changing. Starting a new conversation starts clean.
 */
export async function createPreviewSession(
  supabase: DB,
  args: {
    organizationId: string
    assistantId: string
    createdBy: string
    personaId?: string | null
    title?: string | null
  }
): Promise<string | null> {
  const persona = args.personaId
    ? await getPreviewPersona(supabase, {
        personaId: args.personaId,
        organizationId: args.organizationId,
      })
    : null

  const snapshot: ContactProfile | null = persona
    ? {
        firstName: persona.firstName,
        lastName: persona.lastName,
        phone: persona.phone,
        email: persona.email,
        nationality: persona.nationality,
        country: persona.country,
        preferredLanguage: persona.preferredLanguage,
        notes: persona.notes,
      }
    : null

  const { data, error } = await supabase
    .from("assistant_preview_sessions")
    .insert({
      organization_id: args.organizationId,
      assistant_id: args.assistantId,
      created_by: args.createdBy,
      title: args.title ?? null,
      persona_id: persona?.id ?? null,
      persona_snapshot: snapshot as unknown as Json,
    })
    .select("id")
    .single()

  if (error || !data) return null
  return data.id
}

/** Bump recency only. Titles are LLM-generated (see preview/title.ts) — never derived from message body here. */
export async function touchPreviewSession(supabase: DB, sessionId: string) {
  await supabase
    .from("assistant_preview_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId)
}

export async function insertPreviewMessage(
  supabase: DB,
  args: {
    sessionId: string
    organizationId: string
    role: "user" | "assistant"
    body: string
    parts?: unknown[] | null
    attachmentIds?: string[]
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("assistant_preview_messages")
    .insert({
      session_id: args.sessionId,
      organization_id: args.organizationId,
      role: args.role,
      body: args.body,
      parts: (args.parts ?? null) as Json,
    })
    .select("id")
    .single()

  if (error || !data) return null

  if (args.attachmentIds && args.attachmentIds.length > 0) {
    await supabase
      .from("assistant_preview_attachments")
      .update({ message_id: data.id })
      .in("id", args.attachmentIds)
      .eq("session_id", args.sessionId)
  }

  await touchPreviewSession(supabase, args.sessionId)

  return data.id
}

export async function buildPreviewModelMessages(
  supabase: DB,
  sessionId: string
): Promise<PreviewUIMessage[]> {
  const { data: rows } = await supabase
    .from("assistant_preview_messages")
    .select("id, role, body, parts, created_at")
    .eq("session_id", sessionId)
    // `system` rows are things that happened to the conversation — a contact
    // card being updated — not things anyone said. They belong to the staff
    // reading the thread; handed to the model it would answer them.
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(50)

  if (!rows?.length) return []

  const { data: attachments } = await supabase
    .from("assistant_preview_attachments")
    .select(
      "id, message_id, kind, storage_path, mime_type, filename, size_bytes, extracted_text"
    )
    .eq("session_id", sessionId)

  const attByMessage = new Map<string, ChatAttachmentRecord[]>()
  for (const a of attachments ?? []) {
    if (!a.message_id) continue
    const list = attByMessage.get(a.message_id) ?? []
    list.push({
      storage_path: a.storage_path,
      kind: a.kind as ChatAttachmentRecord["kind"],
      mime_type: a.mime_type,
      filename: a.filename,
      size_bytes: a.size_bytes,
      extracted_text: a.extracted_text,
    })
    attByMessage.set(a.message_id, list)
  }

  const sign = (path: string) => signAttachmentUrl(supabase, path)
  const out: PreviewUIMessage[] = []

  for (const row of rows) {
    const role = row.role === "assistant" ? "assistant" : "user"
    const storedParts = Array.isArray(row.parts) ? (row.parts as unknown[]) : null

    if (role === "assistant" && storedParts?.length) {
      out.push({ id: row.id, role, parts: storedParts })
      continue
    }

    const parts: unknown[] = []
    const text = row.body.trim()
    if (text) parts.push({ type: "text", text })

    const msgAtts = attByMessage.get(row.id) ?? []
    for (const att of msgAtts) {
      if (att.kind === "image") {
        const url = await sign(att.storage_path)
        if (url) {
          parts.push({
            type: "file",
            mediaType: att.mime_type,
            filename: att.filename,
            url,
          })
        }
      } else if (att.extracted_text?.trim()) {
        const clipped =
          att.extracted_text.length > 8000
            ? `${att.extracted_text.slice(0, 8000)}…`
            : att.extracted_text
        parts.push({
          type: "text",
          text: `[Ek belge "${att.filename}"]:\n${clipped}`,
        })
      }
    }

    if (parts.length === 0) continue
    out.push({ id: row.id, role, parts })
  }

  return out
}
