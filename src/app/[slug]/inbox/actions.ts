"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWhatsAppMessage } from "@/lib/whatsapp/cloud-api/client"
import { insertMessage, setConversationStatus } from "@/lib/whatsapp/conversation"
import { recordHandoffEvent } from "@/lib/inbox/record-thread-event"
import type { HandoffEventKind } from "@/lib/inbox/thread-events"
import {
  actorDisplayName,
  applyContactPatch,
  contactPatchSchema,
} from "@/lib/contacts/update"
import { getOlderThreadMessages } from "@/lib/supabase/queries/inbox"
import type { ThreadMessagePage } from "@/lib/supabase/queries/inbox"

export type ActionResult = { ok: true } | { ok: false; error: string }

const statusSchema = z.object({
  conversationId: z.string().uuid(),
  slug: z.string().min(1),
})

const olderMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  before: z.object({
    createdAt: z.string().min(1),
    id: z.string().uuid(),
  }),
})

export type OlderMessagesResult =
  | { ok: true; page: ThreadMessagePage }
  | { ok: false; error: string }

/**
 * The page of messages just before `before`, for the thread's scroll-up
 * pagination. Reads with the caller's own client, so RLS (inbox.access) decides
 * what comes back — an id from another org simply yields nothing.
 */
export async function loadOlderMessages(
  input: z.input<typeof olderMessagesSchema>
): Promise<OlderMessagesResult> {
  const parsed = olderMessagesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const page = await getOlderThreadMessages(
    parsed.data.conversationId,
    parsed.data.before
  )
  return { ok: true, page }
}

type ConversationStatus = "bot" | "needs_human" | "human" | "closed"

/**
 * Flip a conversation's status. RLS (inbox.access) gates the write — a user can
 * only touch conversations in their own orgs. Used for staff takeover
 * (`human`), return-to-bot (`bot`) and closing (`closed`).
 *
 * `event` marks the transitions the thread shows a divider for. It is written
 * only when the status actually moved — two people pressing "Devral" a second
 * apart is one takeover, not two.
 */
async function updateStatus(
  input: z.input<typeof statusSchema>,
  status: ConversationStatus,
  event?: HandoffEventKind
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }
  const { conversationId, slug } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const { data, error } = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", conversationId)
    // Only rows that were on another status come back, so the update itself
    // reports whether anything changed.
    .neq("status", status)
    .select("id, organization_id")
  if (error) return { ok: false, error: error.message }

  const changed = data?.[0]
  if (event && changed) {
    await recordHandoffEvent(supabase, {
      orgId: changed.organization_id,
      conversationId,
      kind: event,
      actorUserId: user.id,
      actorName: await actorDisplayName(supabase, user.id),
    })
  }

  revalidatePath(`/${slug}/inbox`)
  return { ok: true }
}

/** Staff takes over — bot stops auto-replying. */
export async function takeoverConversation(
  input: z.input<typeof statusSchema>
): Promise<ActionResult> {
  return updateStatus(input, "human", "takeover")
}

/** Hand the thread back to the bot. */
export async function returnToBot(
  input: z.input<typeof statusSchema>
): Promise<ActionResult> {
  return updateStatus(input, "bot", "returned_to_assistant")
}

/** Close the conversation. */
export async function closeConversation(
  input: z.input<typeof statusSchema>
): Promise<ActionResult> {
  return updateStatus(input, "closed")
}

const conversationActionSchema = z.object({
  conversationId: z.string().uuid(),
  slug: z.string().min(1),
})

/** Mark a conversation as read (shared team unread counter). */
export async function markConversationRead(
  input: z.input<typeof conversationActionSchema>
): Promise<ActionResult> {
  const parsed = conversationActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }
  const { conversationId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const { error } = await supabase
    .from("conversations")
    .update({
      unread_count: 0,
      last_read_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
  if (error) return { ok: false, error: error.message }

  // Deliberately no `revalidatePath`. Opening a thread already marks it read on
  // the client (`readOverrides`), and this write carries nothing else the page
  // renders — so invalidating the route bought a second full fetch of the list
  // and the thread for every conversation anyone clicked on.
  return { ok: true }
}

/** Pin or unpin a conversation in the inbox list. */
export async function togglePin(
  input: z.input<typeof conversationActionSchema> & { pinned: boolean }
): Promise<ActionResult> {
  const parsed = conversationActionSchema
    .extend({ pinned: z.boolean() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }
  const { conversationId, slug, pinned } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const { error } = await supabase
    .from("conversations")
    .update({
      pinned_at: pinned ? new Date().toISOString() : null,
    })
    .eq("id", conversationId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/${slug}/inbox`)
  return { ok: true }
}

const replySchema = z.object({
  conversationId: z.string().uuid(),
  slug: z.string().min(1),
  body: z.string().trim().min(1, "Mesaj boş olamaz").max(4000),
})

/**
 * Send a staff reply over WhatsApp and persist it. Flow:
 *  1. User-scoped read confirms the conversation is in the caller's org (RLS).
 *  2. Taking over implies `human` status so the bot won't also reply.
 *  3. Admin client fetches the channel's Vault-held WhatsApp access token
 *     (service-role only RPC) and sends the message, then records it as `staff`.
 */
export async function sendStaffReply(
  input: z.input<typeof replySchema>
): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const { conversationId, slug, body } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  // RLS scopes this read to the caller's orgs — confirms access + gives us the
  // org/channel/recipient we need to send.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, organization_id, channel_id, guest_phone, status")
    .eq("id", conversationId)
    .maybeSingle()
  if (!conv) return { ok: false, error: "Konuşma bulunamadı" }
  if (!conv.channel_id) {
    return { ok: false, error: "Bu konuşmaya bağlı bir kanal yok" }
  }

  // Service-role client: read the channel creds + Vault token, send, persist.
  const admin = createAdminClient()
  const { data: channel } = await admin
    .from("channels")
    .select("id, wa_phone_number_id, status")
    .eq("id", conv.channel_id)
    .maybeSingle()
  if (!channel?.wa_phone_number_id) {
    return { ok: false, error: "WhatsApp kanalı yapılandırılmamış" }
  }

  const { data: accessToken } = await admin.rpc("get_channel_wa_token", {
    p_channel_id: channel.id,
  })
  if (!accessToken) {
    return { ok: false, error: "Kanal kimlik bilgileri eksik" }
  }

  const sent = await sendWhatsAppMessage({
    phoneNumberId: channel.wa_phone_number_id,
    accessToken,
    to: conv.guest_phone,
    body,
  })
  if (!sent.ok) {
    return { ok: false, error: sent.error ?? "Mesaj gönderilemedi" }
  }

  // A staff reply means a human is handling this thread now. The takeover is
  // recorded before the reply itself, so the thread reads in the order it
  // happened: someone stepped in, then they wrote.
  const { changed } = await setConversationStatus(admin, conversationId, "human")
  if (changed) {
    await recordHandoffEvent(admin, {
      orgId: conv.organization_id,
      conversationId,
      kind: "takeover",
      actorUserId: user.id,
      actorName: await actorDisplayName(supabase, user.id),
    })
  }

  await insertMessage(admin, {
    orgId: conv.organization_id,
    conversationId,
    role: "staff",
    body,
    providerMessageId: sent.id ?? null,
    senderUserId: user.id,
  })

  revalidatePath(`/${slug}/inbox`)
  return { ok: true }
}

const updateContactSchema = z.object({
  contactId: z.string().uuid(),
  /** Which thread to announce the change in — a contact may have several. */
  conversationId: z.string().uuid(),
  slug: z.string().min(1),
  patch: contactPatchSchema,
})

/**
 * Update a contact's card from the inbox detail panel. RLS (inbox.access,
 * contacts_write_inbox) gates the write to the caller's org.
 *
 * The write itself — including the rule that the thread line comes from
 * diffing the row rather than from the submitted patch — lives in
 * `applyContactPatch`, shared with the Kişiler page. What is local to the
 * inbox is which conversation the change is announced in: the open one.
 */
export async function updateContact(
  input: z.input<typeof updateContactSchema>
): Promise<ActionResult> {
  const parsed = updateContactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const { contactId, conversationId, slug, patch } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const result = await applyContactPatch(supabase, {
    contactId,
    conversationId,
    patch,
    actorUserId: user.id,
  })
  if (!result.ok) return result

  revalidatePath(`/${slug}/inbox`)
  return { ok: true }
}
