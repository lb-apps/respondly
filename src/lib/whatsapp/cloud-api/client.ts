import "server-only"

import {
  buildCarouselPayload,
  buildCtaUrlPayload,
  buildImagePayload,
  buildListPayload,
  buildLocationPayload,
  buildLocationRequestPayload,
  buildReplyButtonsPayload,
  buildTextPayload,
  CAROUSEL_CARD_MIN,
  type CarouselCard,
  type ChoiceOption,
  type ImageSource,
  type InteractiveTrimmings,
  type LocationPin,
} from "./payloads"

/**
 * Minimal WhatsApp Cloud API (Meta Graph) client over fetch — no SDK.
 *
 * This file owns credentials and transport only; the exact JSON we send is
 * built by the pure functions in `./payloads` so it can be unit tested.
 * Server-only. Credentials are passed per-call (sourced per-org from the channel
 * row + Vault); never hardcoded. All sends target the business phone via
 * `phoneNumberId` and use a Bearer access token.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export function graphVersion(): string {
  return process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v25.0"
}

export interface MetaCreds {
  /** Business phone number id (Cloud API sender id — not the E.164 number). */
  phoneNumberId: string
  /** System-user / app access token (Bearer). */
  accessToken: string
}

export interface SendResult {
  ok: boolean
  /** wamid of the sent message. */
  id?: string
  error?: string
}

function endpoint(phoneNumberId: string): string {
  return `https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`
}

/** POST a message payload; returns the wamid or an error string. */
async function postMessage(
  creds: MetaCreds,
  payload: Record<string, unknown>
): Promise<SendResult> {
  try {
    const res = await fetch(endpoint(creds.phoneNumberId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `Meta ${res.status}: ${text.slice(0, 300)}` }
    }

    const json = (await res.json()) as {
      messages?: Array<{ id?: string }>
    }
    return { ok: true, id: json.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" }
  }
}

export interface SendTextParams extends MetaCreds {
  to: string
  body: string
  /** Public URL for an image attachment; when set, sends an image message instead of text. */
  mediaLink?: string
  /**
   * Id of media already uploaded to this sender. Preferred over `mediaLink`:
   * Meta downloads a link synchronously before answering, an id it already has.
   */
  mediaId?: string
}

/** Send a plain text message, or an image message when media is provided. */
export async function sendWhatsAppMessage(params: SendTextParams): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, body, mediaLink, mediaId } = params

  const image = mediaId
    ? { id: mediaId }
    : mediaLink
      ? { link: mediaLink }
      : null

  return postMessage(
    { phoneNumberId, accessToken },
    image ? buildImagePayload(to, image, body) : buildTextPayload(to, body)
  )
}

export type { ChoiceOption }

export interface QuickReplyParams extends MetaCreds, InteractiveTrimmings {
  to: string
  body: string
  options: ChoiceOption[]
}

/**
 * Native interactive reply buttons (max 3). Free-form within the 24h
 * customer-service window — no template approval needed.
 */
export async function sendWhatsAppQuickReply(
  params: QuickReplyParams
): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, body, options } = params
  return postMessage(
    { phoneNumberId, accessToken },
    buildReplyButtonsPayload(to, body, options, params)
  )
}

export interface ListParams extends MetaCreds, InteractiveTrimmings {
  to: string
  body: string
  /** Label on the button that opens the list sheet. */
  buttonLabel: string
  options: ChoiceOption[]
  /** Heading for a group the model left unnamed, in the customer's language. */
  sectionTitleFallback?: string
}

/**
 * Interactive list message — up to 10 rows behind a single button, optionally
 * grouped into sections. This is the right shape for a bounded question with
 * more answers than three buttons can hold (nationality, room type, time slot).
 */
export async function sendWhatsAppList(params: ListParams): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, body, buttonLabel, options } = params
  return postMessage(
    { phoneNumberId, accessToken },
    buildListPayload(to, body, buttonLabel, options, params)
  )
}

export type { CarouselCard }

export interface CarouselParams extends MetaCreds {
  to: string
  body: string
  cards: CarouselCard[]
}

/**
 * Media carousel — 2 to 10 horizontally scrollable cards, each with its own
 * picture and button. The right shape for "here are the options" when the
 * options are things you look at: rooms, dishes, products.
 *
 * Card pictures are sent as links because Meta accepts nothing else here, so
 * this is the one send path that cannot use the uploaded-media cache. Callers
 * must therefore hand over publicly reachable URLs only.
 */
export async function sendWhatsAppCarousel(
  params: CarouselParams
): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, body, cards } = params

  // Guarded here rather than at the call site: every caller would otherwise
  // repeat it, and Meta's error for a one-card carousel is not self-explanatory.
  if (cards.length < CAROUSEL_CARD_MIN) {
    return {
      ok: false,
      error: `carousel needs at least ${CAROUSEL_CARD_MIN} cards, got ${cards.length}`,
    }
  }

  return postMessage(
    { phoneNumberId, accessToken },
    buildCarouselPayload(to, body, cards)
  )
}

export interface SendLocationParams extends MetaCreds, LocationPin {
  to: string
}

/**
 * Send a place as a map pin. Tapping it opens the customer's own map app with
 * directions already possible — which a street address written in text cannot do.
 */
export async function sendWhatsAppLocation(
  params: SendLocationParams
): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, ...pin } = params
  return postMessage({ phoneNumberId, accessToken }, buildLocationPayload(to, pin))
}

export interface LocationRequestParams extends MetaCreds {
  to: string
  body: string
}

/**
 * Ask the customer to share their location — renders a "Send location" button
 * that opens the WhatsApp location picker.
 */
export async function sendWhatsAppLocationRequest(
  params: LocationRequestParams
): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, body } = params
  return postMessage(
    { phoneNumberId, accessToken },
    buildLocationRequestPayload(to, body)
  )
}

export interface TypingIndicatorParams extends MetaCreds {
  /** WAMID of the inbound guest message being responded to. */
  messageId: string
}

/**
 * Mark the guest's message as read and show "typing…" in their WhatsApp
 * client. Tied to a specific inbound message id (Meta requirement) — auto-
 * dismisses after our reply sends or 25s, whichever comes first.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/typing-indicators
 */
export async function sendTypingIndicator(
  params: TypingIndicatorParams
): Promise<SendResult> {
  const { phoneNumberId, accessToken, messageId } = params
  return postMessage(
    { phoneNumberId, accessToken },
    { status: "read", message_id: messageId, typing_indicator: { type: "text" } }
  )
}

export interface CTAParams extends MetaCreds, InteractiveTrimmings {
  to: string
  body: string
  buttonLabel: string
  url: string
  /** Optional picture above the body — a photo of what they are about to book. */
  headerImage?: ImageSource | null
}

/** Native call-to-action URL button (single URL button under the body text). */
export async function sendWhatsAppCTA(params: CTAParams): Promise<SendResult> {
  const { phoneNumberId, accessToken, to, body, buttonLabel, url } = params
  return postMessage(
    { phoneNumberId, accessToken },
    buildCtaUrlPayload(to, body, buttonLabel, url, params)
  )
}
