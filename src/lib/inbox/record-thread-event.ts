import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/database"
import { insertMessage } from "@/lib/whatsapp/conversation"
import {
  contactProfileEventText,
  handoffEventText,
  type ContactProfileChange,
  type HandoffEvent,
  type HandoffEventKind,
  type HandoffReason,
} from "@/lib/inbox/thread-events"

type DB = SupabaseClient<Database>

/**
 * Which thread an event belongs to. The two surfaces keep their messages in
 * different tables, and this is the only place that has to know which.
 */
export type ThreadEventTarget =
  | { kind: "conversation"; conversationId: string }
  | { kind: "preview_session"; sessionId: string }

/**
 * The row that was written, so a live surface can show it without refetching.
 * The preview draws its active conversation from React state, not the database.
 */
export interface RecordedThreadEvent {
  id: string
  createdAt: string
  metadata: { event: { kind: "contact_profile_updated"; changes: ContactProfileChange[] } }
}

/**
 * Writing an event into a thread.
 *
 * Kept apart from `thread-events/` so the divider can import the labels and the
 * parser without pulling the message-writing path — and everything under it —
 * into the client bundle.
 */

/**
 * Write one handoff into the thread, as a `system` message row.
 *
 * Callers pass only transitions that actually happened; `setConversationStatus`
 * reports whether the status moved.
 */
export async function recordHandoffEvent(
  supabase: DB,
  args: {
    orgId: string
    conversationId: string
    kind: HandoffEventKind
    reason?: HandoffReason
    /** The teammate who did it. Null when the assistant did. */
    actorUserId?: string | null
    /** Names them in the stored sentence; the divider resolves it again itself. */
    actorName?: string | null
  }
): Promise<void> {
  const event: HandoffEvent = {
    kind: args.kind,
    ...(args.reason ? { reason: args.reason } : {}),
  }

  await insertMessage(supabase, {
    orgId: args.orgId,
    conversationId: args.conversationId,
    role: "system",
    body: handoffEventText(args.kind, args.actorName),
    senderUserId: args.actorUserId ?? null,
    metadata: { event },
  })
}

/**
 * Write one contact-card change into the thread.
 *
 * `changes` comes from `diffContactProfile`, never from the patch a caller
 * sent — an empty array means nothing moved and there is nothing to announce,
 * which is the common case when someone presses Kaydet on an unedited panel.
 */
export async function recordContactProfileEvent(
  supabase: DB,
  args: {
    orgId: string
    /** Which thread it goes in — a real conversation or a preview session. */
    target: ThreadEventTarget
    changes: ContactProfileChange[]
    /** The teammate who did it. Null when the assistant did. */
    actorUserId?: string | null
    actorName?: string | null
  }
): Promise<RecordedThreadEvent | null> {
  if (args.changes.length === 0) return null

  const event = { kind: "contact_profile_updated" as const, changes: args.changes }
  const body = contactProfileEventText(
    args.changes,
    args.actorUserId ? { name: args.actorName } : null
  )

  if (args.target.kind === "conversation") {
    await insertMessage(supabase, {
      orgId: args.orgId,
      conversationId: args.target.conversationId,
      role: "system",
      body,
      senderUserId: args.actorUserId ?? null,
      metadata: { event },
    })
    return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), metadata: { event } }
  }

  // The preview keeps its own messages table, but the row is the same shape —
  // a `system` role and `{ event }` in the metadata — so one parser reads both.
  const { data } = await supabase
    .from("assistant_preview_messages")
    .insert({
      session_id: args.target.sessionId,
      organization_id: args.orgId,
      role: "system",
      body,
      // The event is a typed union, not an index-signature object, so it needs
      // saying out loud that it is going into a jsonb column.
      metadata: { event } as unknown as Json,
    })
    .select("id, created_at")
    .single()

  if (!data) return null
  return { id: data.id, createdAt: data.created_at, metadata: { event } }
}
