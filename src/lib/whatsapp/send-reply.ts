import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import {
  sendWhatsAppCarousel,
  sendWhatsAppCTA,
  sendWhatsAppList,
  sendWhatsAppLocation,
  sendWhatsAppLocationRequest,
  sendWhatsAppMessage,
  sendWhatsAppQuickReply,
  type MetaCreds,
  type SendResult,
} from "@/lib/whatsapp/cloud-api/client"
import {
  CAROUSEL_CARD_MIN,
  type ImageSource,
} from "@/lib/whatsapp/cloud-api/payloads"
import { choiceTransport } from "@/lib/whatsapp/choice-message"
import { unreachableByMeta } from "@/lib/whatsapp/public-url"
import {
  forgetWhatsAppMedia,
  resolveWhatsAppMediaIds,
  type ResolvedMedia,
} from "@/lib/whatsapp/media-cache"
import { handoffMessage } from "@/lib/whatsapp/handoff-message"
import { optionsLabel } from "@/lib/whatsapp/ui-labels"
import { insertMessage } from "@/lib/whatsapp/conversation"
import type {
  AssistantReply,
  RichMessage,
} from "@/lib/whatsapp/assistant-reply"

type DB = SupabaseClient<Database>

/** One row to write once the reply has gone out. */
type MessageRecord = Parameters<typeof insertMessage>[1]

export interface WhatsAppSendCreds extends MetaCreds {
  to: string
}

/**
 * Send one picture, preferring media we have already uploaded.
 *
 * Three ways this can go, in order of preference: by media id (no Meta-side
 * download, the fast path), by link (Meta fetches the URL while we wait), or
 * not at all when neither is possible.
 */
async function sendImage(
  supabase: DB,
  args: {
    orgId: string
    creds: WhatsAppSendCreds
    imageUrl: string
    caption: string
    resolved: ResolvedMedia | undefined
  },
): Promise<SendResult> {
  const { orgId, creds, imageUrl, caption, resolved } = args

  if (resolved?.mediaId) {
    const sent = await sendWhatsAppMessage({
      ...creds,
      body: caption,
      mediaId: resolved.mediaId,
    })
    if (sent.ok) return sent

    // Keeping the cache honest is our job: if Meta no longer recognises the id,
    // drop the row and let this reply still land via the link below.
    console.warn(
      `[whatsapp] cached media id rejected for ${imageUrl}: ${sent.error}`,
    )
    void forgetWhatsAppMedia(supabase, {
      orgId,
      phoneNumberId: creds.phoneNumberId,
      url: imageUrl,
    }).catch(() => {})
  }

  // Falling back to `link` means Meta fetches the URL from its own servers, so
  // it must be publicly reachable. A private address fails *after* the API
  // returns a message id, so skip it loudly instead.
  const unreachable = unreachableByMeta(imageUrl)
  if (unreachable) {
    const reason = resolved?.error
      ? `${resolved.error}; ${unreachable}`
      : unreachable
    console.error(`[whatsapp] not sending image ${imageUrl}: ${reason}`)
    return { ok: false, error: reason }
  }

  if (resolved?.error) {
    console.warn(
      `[whatsapp] could not upload ${imageUrl} (${resolved.error}), sending by link`,
    )
  }

  return sendWhatsAppMessage({ ...creds, body: caption, mediaLink: imageUrl })
}

/**
 * The picture above a link button, or nothing.
 *
 * Same preference as a picture message — an id Meta already holds beats a URL
 * it has to fetch. Unlike a picture message there is no second chance here: the
 * header travels with the button, so an image we cannot vouch for is dropped
 * rather than risking the whole message.
 */
function ctaHeaderImage(
  imageUrl: string,
  resolved: ResolvedMedia | undefined,
): ImageSource | null {
  if (resolved?.mediaId) return { id: resolved.mediaId }

  const unreachable = unreachableByMeta(imageUrl)
  if (unreachable) {
    console.warn(
      `[whatsapp] link button sent without its picture ${imageUrl}: ${unreachable}`,
    )
    return null
  }
  return { link: imageUrl }
}

/**
 * Send a carousel, or the closest thing that still says what it meant.
 *
 * Card pictures cannot be media ids — Meta only accepts links here — so this is
 * the one path that skips the upload cache and hands over URLs, which in turn
 * makes an unreachable one fatal to its card. What survives decides the shape:
 * two cards or more is the carousel the model asked for; one is the same offer
 * as a link button with its picture; none leaves the introduction, which is a
 * sentence worth sending on its own.
 */
async function sendCarousel(
  creds: WhatsAppSendCreds,
  message: Extract<RichMessage, { type: "carousel" }>,
): Promise<SendResult> {
  const cards = message.cards.filter((card) => {
    const unreachable = unreachableByMeta(card.imageUrl)
    if (unreachable) {
      console.warn(
        `[whatsapp] carousel card dropped, Meta cannot fetch ${card.imageUrl}: ${unreachable}`,
      )
    }
    return !unreachable
  })

  if (cards.length >= CAROUSEL_CARD_MIN) {
    return sendWhatsAppCarousel({ ...creds, body: message.body, cards })
  }

  const only = cards[0]
  const link = only?.buttons.find((button) => button.url)
  if (only && link?.url) {
    return sendWhatsAppCTA({
      ...creds,
      body: message.body,
      buttonLabel: link.label,
      url: link.url,
      headerImage: { link: only.imageUrl },
    })
  }
  if (only) {
    return sendWhatsAppMessage({
      ...creds,
      body: message.body,
      mediaLink: only.imageUrl,
    })
  }
  return sendWhatsAppMessage({ ...creds, body: message.body })
}

/**
 * Deliver an assistant reply over WhatsApp (Meta Cloud API) and persist each
 * outbound message.
 */
export async function sendAssistantReply(
  supabase: DB,
  args: {
    orgId: string
    conversationId: string
    creds: WhatsAppSendCreds
    reply: AssistantReply
    /** Customer's language, for the handoff line when the assistant wrote none. */
    guestLocale?: string | null
  },
): Promise<void> {
  const { orgId, conversationId, creds, reply } = args

  // Every message is sent first and written down afterwards.
  //
  // Recording one costs two round trips to the database, and doing that between
  // two sends puts a fifth of a second of dead air between the customer's
  // photos — four pictures used to arrive over the best part of a second longer
  // than they had to. Nothing here needs the row id, so the whole reply goes
  // out back-to-back and the rows are written once it has.
  const pending: MessageRecord[] = []

  // Start uploading before the text goes out: a reply with six pictures used to
  // pay a Meta-side download per picture, one after the other. Uploaded media
  // is reused across conversations, so in steady state this resolves from cache.
  // Both plain pictures and the photo on a link button go through the cache;
  // a booking button should not wait on a Meta-side download either.
  const imageUrls = reply.richContent.flatMap((rich) => {
    if (rich.type === "image") return [rich.imageUrl]
    if (rich.type === "cta" && rich.imageUrl) return [rich.imageUrl]
    return []
  })

  const mediaPromise =
    imageUrls.length > 0
      ? resolveWhatsAppMediaIds(supabase, {
          orgId,
          creds,
          urls: imageUrls,
        }).catch((err: unknown) => {
          console.error(`[whatsapp] media upload failed: ${String(err)}`)
          return new Map<string, ResolvedMedia>()
        })
      : null

  // Handing off without a word reads as being ignored. The assistant normally
  // writes its own line; this is the safety net for when it produced nothing.
  const body =
    reply.text || (reply.escalate ? handoffMessage(args.guestLocale) : "")

  if (body) {
    const sent = await sendWhatsAppMessage({ ...creds, body })
    pending.push({
      orgId,
      conversationId,
      role: "assistant",
      body,
      providerMessageId: sent.id ?? null,
      metadata: sent.ok ? {} : { sendError: sent.error },
    })
  }

  const media = mediaPromise ? await mediaPromise : null

  try {
    for (const rich of reply.richContent) {
      if (rich.type === "image") {
        const sent = await sendImage(supabase, {
          orgId,
          creds,
          imageUrl: rich.imageUrl,
          caption: rich.caption ?? "",
          resolved: media?.get(rich.imageUrl),
        })

        pending.push({
          orgId,
          conversationId,
          role: "assistant",
          body: rich.caption ?? "",
          type: "media",
          providerMessageId: sent.id ?? null,
          metadata: sent.ok ? {} : { sendError: sent.error },
          richContent: [rich],
        })
      } else if (rich.type === "choice") {
        // The model asked a bounded question; WhatsApp's shape rules decide how
        // it is rendered. Three answers or fewer fit as tappable buttons, more
        // need the list sheet.
        const sent =
          choiceTransport(rich.options, rich.descriptionsMatter) === "buttons"
            ? await sendWhatsAppQuickReply({
                ...creds,
                body: rich.body,
                options: rich.options,
                footerText: rich.footer,
              })
            : await sendWhatsAppList({
                ...creds,
                body: rich.body,
                buttonLabel:
                  rich.listButtonLabel || optionsLabel(args.guestLocale),
                options: rich.options,
                footerText: rich.footer,
                sectionTitleFallback: optionsLabel(args.guestLocale),
              })
        pending.push({
          orgId,
          conversationId,
          role: "assistant",
          body: rich.body,
          type: "interactive",
          providerMessageId: sent.id ?? null,
          metadata: sent.ok ? {} : { sendError: sent.error },
          richContent: [rich],
        })
      } else if (rich.type === "carousel") {
        const sent = await sendCarousel(creds, rich)
        pending.push({
          orgId,
          conversationId,
          role: "assistant",
          body: rich.body,
          type: "interactive",
          providerMessageId: sent.id ?? null,
          metadata: sent.ok ? {} : { sendError: sent.error },
          richContent: [rich],
        })
      } else if (rich.type === "location") {
        const sent = await sendWhatsAppLocation({
          ...creds,
          latitude: rich.latitude,
          longitude: rich.longitude,
          name: rich.name,
          address: rich.address,
        })
        pending.push({
          orgId,
          conversationId,
          role: "assistant",
          // The pin is the message; this is what the conversation list shows.
          body: rich.name || rich.address || "Konum",
          type: "media",
          providerMessageId: sent.id ?? null,
          metadata: sent.ok ? {} : { sendError: sent.error },
          richContent: [rich],
        })
      } else if (rich.type === "location_request") {
        const sent = await sendWhatsAppLocationRequest({
          ...creds,
          body: rich.body,
        })
        pending.push({
          orgId,
          conversationId,
          role: "assistant",
          body: rich.body,
          type: "interactive",
          providerMessageId: sent.id ?? null,
          metadata: sent.ok ? {} : { sendError: sent.error },
          richContent: [rich],
        })
      } else if (rich.type === "cta") {
        const sent = await sendWhatsAppCTA({
          ...creds,
          body: rich.body,
          buttonLabel: rich.buttonLabel,
          url: rich.url,
          headerImage: rich.imageUrl
            ? ctaHeaderImage(rich.imageUrl, media?.get(rich.imageUrl))
            : null,
        })
        pending.push({
          orgId,
          conversationId,
          role: "assistant",
          body: rich.body,
          type: "interactive",
          providerMessageId: sent.id ?? null,
          richContent: [rich],
        })
      }
    }
  } finally {
    // One turn fans out into several rows — the text, then one per rich item.
    // The tool trace describes the turn, not any single message, so it rides on
    // the first row that made it out. Attached here rather than at each push
    // site so there is exactly one place that decides who owns it.
    if (pending.length > 0 && reply.toolTrace.length > 0) {
      pending[0].toolTrace = reply.toolTrace
    }

    // In a `finally` so a send that throws still leaves a record of everything
    // that reached the customer before it. Sequential on purpose: the rows are
    // ordered by their timestamps, and the inbox reads them back that way.
    for (const record of pending) {
      await insertMessage(supabase, record)
    }
  }
}
