import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/database"
import type { RichMessage } from "@/lib/whatsapp/assistant-reply"
import type { ToolTracePart } from "@/lib/assistant/tool-trace"
import { buildWhatsAppModelHistory } from "@/lib/assistant/attachments/history"
import { serializeAttachmentsForMetadata } from "@/lib/assistant/attachments/parts"
import type { ChatAttachmentRecord } from "@/lib/assistant/attachments/types"
import { getPhoneCountry } from "@/lib/phone"

type DB = SupabaseClient<Database>

/**
 * Conversation persistence for the WhatsApp loop. Runs with a service-role
 * client (webhook has no user session). Each call is org-scoped via explicit
 * organization_id, so no cross-org leakage despite RLS bypass.
 */

export interface InboundMessageRecord {
  contactId: string
  conversationId: string
  conversationStatus: string
  conversationLanguage: string
  messageId: string
}

/**
 * Land an inbound WhatsApp message: the contact behind the number, the
 * conversation it belongs to, and the message row itself.
 *
 * One round trip, deliberately. Walking these as separate statements put four
 * sequential trips to another region on the critical path of every message —
 * Meta waits for the 200 and the assistant turn cannot start until they finish,
 * so that latency was the customer's. It also raced: two messages arriving
 * together both read "no conversation" and both created one, and sending
 * several messages in a row is precisely what people do. The function holds an
 * advisory lock over (channel, phone) for the duration.
 *
 * `country` is derived here rather than in SQL because the dialling-code tables
 * live in libphonenumber. It is a guess, and the function only writes it — like
 * the push name — when the field is still empty, so a correction survives the
 * customer's next line.
 */
export async function recordInboundMessage(
  supabase: DB,
  args: {
    orgId: string
    channelId: string
    phone: string
    profileName?: string | null
    body: string
    type?: "text" | "media"
    providerMessageId?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<InboundMessageRecord | null> {
  const { data, error } = await supabase.rpc("record_inbound_whatsapp_message", {
    p_org_id: args.orgId,
    p_channel_id: args.channelId,
    p_phone: args.phone,
    p_profile_name: args.profileName ?? undefined,
    p_country: getPhoneCountry(args.phone) ?? undefined,
    p_body: args.body,
    p_type: args.type ?? "text",
    p_provider_message_id: args.providerMessageId ?? undefined,
    p_metadata: (args.metadata ?? {}) as Json,
  })

  if (error) {
    console.error(`[whatsapp] inbound write failed for ${args.phone}: ${error.message}`)
    return null
  }

  const row = data?.[0]
  if (!row) return null

  return {
    contactId: row.contact_id,
    conversationId: row.conversation_id,
    conversationStatus: row.conversation_status,
    conversationLanguage: row.conversation_language,
    messageId: row.message_id,
  }
}

/**
 * Hang downloaded files onto a message that is already in the thread.
 *
 * Media arrives as an id, not bytes: fetching it from Meta and putting it in
 * storage takes long enough that waiting for it before writing the row would
 * hold the message out of the inbox for the whole download. The row goes in
 * first and the files follow, which is also the order the customer's own
 * WhatsApp shows them in.
 *
 * `metadata` is the base the row was written with, so nothing already on it is
 * lost. The trigger on this column re-derives the conversation preview, turning
 * "📎 Ek" into the actual filename.
 */
export async function attachMessageMedia(
  supabase: DB,
  args: {
    orgId: string
    messageId: string
    metadata?: Record<string, unknown>
    attachments: ChatAttachmentRecord[]
  }
): Promise<void> {
  if (args.attachments.length === 0) return

  const metadata: Record<string, unknown> = {
    ...(args.metadata ?? {}),
    attachments: serializeAttachmentsForMetadata(args.attachments),
  }

  const { error } = await supabase
    .from("messages")
    .update({ metadata: metadata as Json })
    .eq("id", args.messageId)
    .eq("organization_id", args.orgId)

  if (error) {
    console.error(
      `[whatsapp] could not attach media to message ${args.messageId}: ${error.message}`
    )
  }
}

export async function insertMessage(
  supabase: DB,
  args: {
    orgId: string
    conversationId: string
    role: "guest" | "assistant" | "staff" | "system"
    body: string
    type?: "text" | "interactive" | "template" | "media"
    providerMessageId?: string | null
    senderUserId?: string | null
    metadata?: Record<string, unknown>
    attachments?: ChatAttachmentRecord[]
    richContent?: RichMessage[]
    /**
     * Which tools the assistant turn called. A turn fans out into several rows,
     * so only the first one carries this — see `sendAssistantReply`.
     */
    toolTrace?: ToolTracePart[]
  }
): Promise<string | null> {
  const metadata: Record<string, unknown> = { ...(args.metadata ?? {}) }
  if (args.attachments && args.attachments.length > 0) {
    metadata.attachments = serializeAttachmentsForMetadata(args.attachments)
  }

  const messageType =
    args.type ?? (args.attachments && args.attachments.length > 0 ? "media" : "text")

  const { data } = await supabase
    .from("messages")
    .insert({
      organization_id: args.orgId,
      conversation_id: args.conversationId,
      role: args.role,
      body: args.body,
      type: messageType,
      provider_message_id: args.providerMessageId ?? null,
      sender_user_id: args.senderUserId ?? null,
      metadata: metadata as Json,
      rich_content: args.richContent ? (args.richContent as unknown as Json) : null,
      // Null rather than [] when no tool ran, so a tool-less turn is
      // indistinguishable from a row written before this column existed.
      tool_trace:
        args.toolTrace && args.toolTrace.length > 0
          ? (args.toolTrace as unknown as Json)
          : null,
    })
    .select("id")
    .single()

  // `last_message_at` / `last_message_preview` are not written here. A trigger
  // on this insert derives both — including the "📎 filename" preview an
  // attachment deserves — so every writer keeps the conversation row
  // consistent, and no message costs a second round trip to restate it.
  return data?.id ?? null
}

/**
 * The rich content of a message we sent, found by the id Meta knows it as.
 *
 * Used to read a tap: the inbound reply names the message it answers, and what
 * we put on those buttons is stored here. Org-scoped, like every other read.
 */
export async function getRichContentByProviderId(
  supabase: DB,
  args: { orgId: string; providerMessageId: string }
): Promise<unknown> {
  const { data } = await supabase
    .from("messages")
    .select("rich_content")
    .eq("organization_id", args.orgId)
    .eq("provider_message_id", args.providerMessageId)
    .maybeSingle()

  return data?.rich_content ?? null
}

/**
 * Move a conversation to `status`, and say whether that actually moved it.
 *
 * A turn can reach the same status twice — two failing turns in a row both end
 * in `needs_human` — and the timeline must not show the same handoff twice. The
 * `neq` makes the database decide: a row comes back only when the status it
 * held differed, so the answer is the write itself rather than a read before it
 * that another writer could invalidate.
 */
export async function setConversationStatus(
  supabase: DB,
  conversationId: string,
  status: "bot" | "needs_human" | "human" | "closed"
): Promise<{ changed: boolean }> {
  const { data } = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    .neq("status", status)
    .select("id")

  return { changed: (data?.length ?? 0) > 0 }
}

/** Recent turns as multimodal model messages (chronological). */
export async function getConversationHistory(
  supabase: DB,
  conversationId: string,
  limit = 20
) {
  const { data } = await supabase
    .from("messages")
    // `rich_content` rides along so a past turn comes back as what was
    // delivered — a carousel, a photo, a pin — and not only as its words.
    // Kept narrow on purpose: `tool_trace` stays out, it is for the team's eyes.
    .select("role, body, metadata, rich_content, created_at")
    .eq("conversation_id", conversationId)
    .in("role", ["guest", "assistant", "staff"])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!data) return []

  const chronological = [...data].reverse()
  return buildWhatsAppModelHistory(supabase, chronological)
}
