import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { generateAssistantReply } from "@/lib/whatsapp/assistant-reply"
import { sendAssistantReply } from "@/lib/whatsapp/send-reply"
import { insertMessage, setConversationStatus } from "@/lib/whatsapp/conversation"
import { handoffMessage } from "@/lib/whatsapp/handoff-message"
import { recordHandoffEvent } from "@/lib/inbox/record-thread-event"
import type { HandoffReason } from "@/lib/inbox/thread-events"
import {
  sendTypingIndicator,
  sendWhatsAppMessage,
} from "@/lib/whatsapp/cloud-api/client"

type DB = SupabaseClient<Database>

import { TURN_DEBOUNCE_MS } from "@/lib/assistant/turn-debounce"

export { TURN_DEBOUNCE_MS }

export interface ConversationTurnJob {
  conversationId: string
  orgId: string
  channelId: string
  triggerMessageId: string
  guestPhone: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getLatestGuestMessageId(
  supabase: DB,
  conversationId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_latest_guest_message_id", {
    p_conversation_id: conversationId,
  })
  if (error) return null
  return typeof data === "string" ? data : null
}

async function isTriggerStillLatest(
  supabase: DB,
  conversationId: string,
  triggerMessageId: string
): Promise<boolean> {
  const latest = await getLatestGuestMessageId(supabase, conversationId)
  return latest === triggerMessageId
}

async function tryClaimTurn(
  supabase: DB,
  conversationId: string,
  triggerMessageId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("try_claim_conversation_turn", {
    p_conversation_id: conversationId,
    p_trigger_message_id: triggerMessageId,
  })
  if (error) return false
  return data === true
}

async function releaseTurn(
  supabase: DB,
  conversationId: string,
  triggerMessageId: string
): Promise<void> {
  await supabase.rpc("release_conversation_turn", {
    p_conversation_id: conversationId,
    p_trigger_message_id: triggerMessageId,
  })
}

async function resolveMetaCreds(
  supabase: DB,
  channelId: string,
  guestPhone: string
): Promise<{
  phoneNumberId: string
  accessToken: string
  to: string
} | null> {
  const { data: channel } = await supabase
    .from("channels")
    .select("wa_phone_number_id")
    .eq("id", channelId)
    .maybeSingle()

  if (!channel?.wa_phone_number_id) return null

  const { data: accessToken } = await supabase.rpc("get_channel_wa_token", {
    p_channel_id: channelId,
  })

  if (!accessToken) return null

  return {
    phoneNumberId: channel.wa_phone_number_id,
    accessToken,
    to: guestPhone,
  }
}

/**
 * Last word to the customer when a turn crashed.
 *
 * Best effort by definition — this runs on the failure path, so it must never
 * raise a second error. Credentials are resolved again here because the crash
 * may have happened before the caller got them.
 */
async function notifyHandoffAfterFailure(
  supabase: DB,
  job: ConversationTurnJob,
  language: string | null
): Promise<void> {
  try {
    const creds = await resolveMetaCreds(supabase, job.channelId, job.guestPhone)
    if (!creds) return

    const body = handoffMessage(language, "failure")
    const sent = await sendWhatsAppMessage({ ...creds, body })
    await insertMessage(supabase, {
      orgId: job.orgId,
      conversationId: job.conversationId,
      role: "assistant",
      body,
      providerMessageId: sent.id ?? null,
      metadata: {
        handoff: "turn_failed",
        ...(sent.ok ? {} : { sendError: sent.error }),
      },
    })
  } catch (err) {
    console.error(
      `[assistant] could not notify handoff for ${job.conversationId}:`,
      err
    )
  }
}

/**
 * Hand the conversation to the team, and leave a mark in the thread saying so.
 *
 * The event is written only when the status actually moved: a conversation
 * already waiting for a person is still waiting, and a second divider would
 * claim a handoff that never happened.
 */
async function escalateToHuman(
  supabase: DB,
  job: ConversationTurnJob,
  reason: HandoffReason
): Promise<void> {
  const { changed } = await setConversationStatus(
    supabase,
    job.conversationId,
    "needs_human"
  )
  if (!changed) return

  await recordHandoffEvent(supabase, {
    orgId: job.orgId,
    conversationId: job.conversationId,
    kind: "handoff_to_human",
    reason,
  })
}

/**
 * Debounced, latest-wins conversation turn processor.
 * Call from Next.js `after()` so the webhook returns immediately.
 */
export async function enqueueConversationTurn(
  supabase: DB,
  job: ConversationTurnJob
): Promise<void> {
  await sleep(TURN_DEBOUNCE_MS)

  if (!(await isTriggerStillLatest(supabase, job.conversationId, job.triggerMessageId))) {
    return
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("status, language")
    .eq("id", job.conversationId)
    .maybeSingle()

  if (!conversation || conversation.status !== "bot") {
    return
  }

  if (!(await tryClaimTurn(supabase, job.conversationId, job.triggerMessageId))) {
    return
  }

  // Whether the customer already heard from us this turn, so a late failure
  // does not stack a second message on top of a reply that did go out.
  let replySent = false

  try {
    const creds = await resolveMetaCreds(supabase, job.channelId, job.guestPhone)
    if (!creds) {
      // No channel credentials means no way to reach them at all — the status
      // change is the only signal we can raise.
      console.error(
        `[assistant] no WhatsApp credentials for channel ${job.channelId}`
      )
      await escalateToHuman(supabase, job, "no_credentials")
      return
    }

    // "Yazıyor…" while the LLM/tools run — not during the debounce silence
    // window. Tied to the guest's WAMID (Meta requirement); best-effort, a
    // failure here must never block the reply.
    const { data: triggerMessage } = await supabase
      .from("messages")
      .select("provider_message_id")
      .eq("id", job.triggerMessageId)
      .maybeSingle()
    if (triggerMessage?.provider_message_id) {
      void sendTypingIndicator({ ...creds, messageId: triggerMessage.provider_message_id })
    }

    const reply = await generateAssistantReply(supabase, {
      orgId: job.orgId,
      conversationId: job.conversationId,
    })

    if (!(await isTriggerStillLatest(supabase, job.conversationId, job.triggerMessageId))) {
      return
    }

    await sendAssistantReply(supabase, {
      orgId: job.orgId,
      conversationId: job.conversationId,
      creds,
      reply,
      guestLocale: conversation.language,
    })
    replySent = true

    if (reply.escalate) {
      await escalateToHuman(supabase, job, "assistant_escalated")
    }
  } catch (err) {
    // A turn that throws used to end here in silence: the customer got nothing,
    // staff saw only a status change, and the error itself was discarded — which
    // made the failure impossible to diagnose afterwards. Say something, to the
    // customer and to the log.
    console.error(
      `[assistant] turn ${job.conversationId} failed: ${
        err instanceof Error ? err.stack ?? err.message : String(err)
      }`
    )
    if (!replySent) {
      await notifyHandoffAfterFailure(supabase, job, conversation.language)
    }
    await escalateToHuman(supabase, job, "turn_failed")
  } finally {
    await releaseTurn(supabase, job.conversationId, job.triggerMessageId)

    const latestId = await getLatestGuestMessageId(supabase, job.conversationId)
    if (latestId && latestId !== job.triggerMessageId) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("status")
        .eq("id", job.conversationId)
        .maybeSingle()

      if (conv?.status === "bot") {
        await enqueueConversationTurn(supabase, {
          ...job,
          triggerMessageId: latestId,
        })
      }
    }
  }
}
