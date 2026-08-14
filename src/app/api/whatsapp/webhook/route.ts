import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyMetaSignature, webhookVerifyChallenge } from "@/lib/whatsapp/cloud-api/signature"
import { downloadWhatsAppMedia } from "@/lib/whatsapp/cloud-api/media"
import { normalizePhone } from "@/lib/whatsapp/cloud-api/phone"
import {
  attachMessageMedia,
  getRichContentByProviderId,
  recordInboundMessage,
} from "@/lib/whatsapp/conversation"
import { enqueueConversationTurn } from "@/lib/whatsapp/turn-runner"
import { tapTextFromRichContent } from "@/lib/whatsapp/carousel-message"
import { interactiveReply, tapText } from "@/lib/whatsapp/inbound-tap"
import {
  describeSharedLocation,
  sharedLocationMetadata,
} from "@/lib/whatsapp/inbound-location"
import { extFromMime } from "@/lib/assistant/attachments/constants"
import { uploadChatAttachment } from "@/lib/assistant/attachments/storage"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * WhatsApp Cloud API webhook (Meta). ONE callback per app: Meta posts every
 * event here and does NOT carry our token in the path, so we route by the
 * inbound `phone_number_id` → the matching channel (service-role; org-scoped
 * downstream, no cross-org leak).
 *
 * GET  → verification handshake (echo hub.challenge when the verify token matches).
 * POST → HMAC-SHA256 signature check over the raw body, then parse + persist +
 *        schedule the assistant turn via after(). Always 200 so Meta doesn't retry-storm.
 */

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const challenge = webhookVerifyChallenge(
    url.searchParams,
    process.env.WHATSAPP_VERIFY_TOKEN ?? ""
  )
  if (challenge === null) {
    return new Response("verification failed", { status: 403 })
  }
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  })
}

// ── Meta payload shapes (only what we consume) ────────────────────────────────

interface MetaMediaObject {
  id?: string
  mime_type?: string
  caption?: string
  filename?: string
}

interface MetaMessage {
  from?: string
  id?: string
  type?: string
  text?: { body?: string }
  image?: MetaMediaObject
  document?: MetaMediaObject
  video?: MetaMediaObject
  audio?: MetaMediaObject
  sticker?: MetaMediaObject
  /** Quick reply on a template or a carousel card. `payload` is our own id. */
  button?: { text?: string; payload?: string }
  interactive?: {
    type?: string
    button_reply?: { id?: string; title?: string }
    list_reply?: { id?: string; title?: string }
  }
  /**
   * The customer shared a place — either on their own, or after we asked with
   * `request_location`. `name` and `address` appear only if they chose to send
   * them; the coordinates always do.
   */
  location?: {
    latitude?: number
    longitude?: number
    name?: string
    address?: string
  }
  /** Present on a reply: `id` is the wamid of the message being answered. */
  context?: { id?: string }
}


/**
 * Delivery receipt for a message we sent. `failed` is the only one we act on:
 * Meta accepts the send synchronously (we get a wamid) and only later reports
 * that it could not deliver — e.g. it could not fetch a media `link`. Without
 * this the failure is invisible and the dashboard shows a message the customer
 * never received.
 */
interface MetaStatus {
  id?: string
  status?: string
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>
}

interface MetaValue {
  metadata?: { phone_number_id?: string }
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
  messages?: MetaMessage[]
  statuses?: MetaStatus[]
}

/** Flatten Meta's error array into one readable line. */
function statusErrorText(status: MetaStatus): string {
  const first = status.errors?.[0]
  if (!first) return "Meta could not deliver this message"
  return [first.code ? `(${first.code})` : "", first.title, first.error_data?.details ?? first.message]
    .filter(Boolean)
    .join(" ")
    .trim()
}

/** Media object + suggested filename base for a media-type message, else null. */
function mediaOf(msg: MetaMessage): MetaMediaObject | null {
  switch (msg.type) {
    case "image":
      return msg.image ?? null
    case "document":
      return msg.document ?? null
    case "video":
      return msg.video ?? null
    case "audio":
      return msg.audio ?? null
    case "sticker":
      return msg.sticker ?? null
    default:
      return null
  }
}

/** Human-visible text for a message (caption, typed reply title, or template button). */
function textOf(msg: MetaMessage): string {
  if (msg.type === "text") return (msg.text?.body ?? "").trim()
  const reply = interactiveReply(msg)
  if (reply) {
    // Carousel cards all carry the same labels — "Detaylar", "Seç" — so the
    // title alone loses which card was tapped. `show_carousel` puts the card's
    // name in the id for exactly this moment; Meta hands it back untouched.
    return tapText(reply) ?? (reply.title ?? "").trim()
  }
  if (msg.type === "location") {
    return describeSharedLocation(msg.location) ?? ""
  }
  const media = mediaOf(msg)
  return (media?.caption ?? "").trim()
}

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text()

  const valid = verifyMetaSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
    process.env.WHATSAPP_APP_SECRET ?? ""
  )
  if (!valid) {
    return new Response("invalid signature", { status: 403 })
  }

  let payload: { entry?: Array<{ changes?: Array<{ value?: MetaValue }> }> }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response(null, { status: 200 })
  }

  const supabase = createAdminClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId = value?.metadata?.phone_number_id
      const messages = value?.messages ?? []

      // Delivery receipts arrive on their own change entries, with no messages.
      for (const status of value?.statuses ?? []) {
        if (status.status !== "failed" || !status.id) continue
        const error = statusErrorText(status)
        console.error(`[whatsapp] undelivered ${status.id}: ${error}`)
        await supabase
          .from("messages")
          .update({ metadata: { deliveryError: error } })
          .eq("provider_message_id", status.id)
      }

      if (!phoneNumberId || messages.length === 0) continue

      // Resolve the channel by the inbound business phone_number_id.
      const { data: channel } = await supabase
        .from("channels")
        .select("id, organization_id, status")
        .eq("wa_phone_number_id", phoneNumberId)
        .maybeSingle()
      if (!channel) continue

      const orgId = channel.organization_id
      const profileName = value?.contacts?.[0]?.profile?.name ?? null

      // Access token only needed if we must download media.
      let accessToken: string | null = null
      const needsMedia = messages.some((m) => mediaOf(m) !== null)
      if (needsMedia) {
        const { data } = await supabase.rpc("get_channel_wa_token", {
          p_channel_id: channel.id,
        })
        accessToken = data ?? null
      }

      for (const msg of messages) {
        const from = msg.from ? normalizePhone(msg.from) : ""
        let body = textOf(msg)
        const media = mediaOf(msg)

        // A tap whose id we cannot read on its own — a card sent by an older
        // version, a list row — is still answerable: WhatsApp names the message
        // it replied to, and we stored what we put on those buttons. Without
        // this the assistant receives a bare "Detaylar" and has to ask which of
        // the four rooms it belonged to.
        const reply = interactiveReply(msg)
        if (reply && !tapText(reply)) {
          const richContent = msg.context?.id
            ? await getRichContentByProviderId(supabase, {
                orgId,
                providerMessageId: msg.context.id,
              })
            : null
          const resolved = tapTextFromRichContent(richContent, reply)
          if (resolved) body = resolved
          else {
            // Neither route worked, so the assistant is about to receive a bare
            // "Detaylar" and ask which room it meant. The shape is logged
            // rather than guessed at: Meta delivers a tap three different ways
            // and this is how a fourth would announce itself.
            console.warn(
              `[whatsapp] unresolved tap: type=${msg.type} id=${reply.id ?? "-"} title=${reply.title ?? "-"} context=${msg.context?.id ?? "-"}`
            )
          }
        }

        if (!from || (!body && !media)) continue

        // Coordinates kept as numbers as well as words, so the inbox can put a
        // pin on a map and a tool can pass them on without re-parsing text.
        const metadata = sharedLocationMetadata(msg.location) ?? undefined

        // Contact, conversation and message in one statement — see
        // `recordInboundMessage`. Media is not waited for: the row lands now and
        // the file is hung on it below, once Meta has handed it over.
        const inbound = await recordInboundMessage(supabase, {
          orgId,
          channelId: channel.id,
          phone: from,
          profileName,
          body,
          type: media ? "media" : "text",
          providerMessageId: msg.id ?? null,
          metadata,
        })
        if (!inbound) continue

        if (media?.id && accessToken) {
          const downloaded = await downloadWhatsAppMedia(media.id, accessToken)
          if (downloaded) {
            const ext = extFromMime(downloaded.mimeType || media.mime_type || "")
            const filename = media.filename || `whatsapp-${msg.id ?? "media"}.${ext}`
            const att = await uploadChatAttachment(supabase, {
              orgId,
              threadId: inbound.conversationId,
              data: downloaded.data,
              mimeType: downloaded.mimeType || media.mime_type || "application/octet-stream",
              filename,
            })
            if (att) {
              await attachMessageMedia(supabase, {
                orgId,
                messageId: inbound.messageId,
                metadata,
                attachments: [att],
              })
            }
          }
        }

        // Only the bot auto-replies; if a human took over or the thread is
        // closed, just record the message for the inbox.
        if (inbound.conversationStatus !== "bot") continue

        after(async () => {
          const bg = createAdminClient()
          await enqueueConversationTurn(bg, {
            conversationId: inbound.conversationId,
            orgId,
            channelId: channel.id,
            triggerMessageId: inbound.messageId,
            guestPhone: from,
          })
        })
      }
    }
  }

  return new Response(null, { status: 200 })
}
