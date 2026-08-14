import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { insertMessage } from "@/lib/whatsapp/conversation"
import {
  handoffEventText,
  type HandoffEvent,
  type HandoffEventKind,
  type HandoffReason,
} from "@/lib/inbox/handoff-events"

type DB = SupabaseClient<Database>

/**
 * Write one handoff into the thread, as a `system` message row.
 *
 * Kept apart from `handoff-events.ts` so the divider can import the labels and
 * the parser without pulling the message-writing path — and everything under
 * it — into the client bundle.
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
