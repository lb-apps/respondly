/**
 * Every limit Meta imposes on a message we send, in one place.
 *
 * These numbers were drifting: the payload builders held one copy and each tool
 * schema held another, typed by hand. A limit that disagrees with itself is
 * worse than no limit — the tool accepts what the builder then silently cuts.
 * So this module is the single source, `payloads.ts` enforces from it, and the
 * tools declare their schemas from it.
 *
 * Every constant carries its source. `docs:` means the value was read from the
 * page named, verbatim; `assumed:` means Meta does not state it and we chose.
 * Anything without a source does not belong here.
 *
 * Docs root: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/
 */

// ── Text messages ───────────────────────────────────────────────────────────
// docs: text-messages — "Maximum 4096 characters."
export const TEXT_BODY_MAX = 4096

// ── Interactive: reply buttons ──────────────────────────────────────────────
// docs: interactive-reply-buttons-messages — "Supports up to 3 buttons."
export const REPLY_BUTTON_MAX = 3
// docs: same page — "Button label text. Must be unique if using multiple
// buttons. Maximum 20 characters."
export const BUTTON_TITLE_MAX = 20
// docs: same page — "A unique identifier for each button. Maximum 256 characters."
export const REPLY_BUTTON_ID_MAX = 256
// docs: same page — "Body text. URLs are automatically hyperlinked. Maximum
// 1024 characters."
export const BUTTON_BODY_MAX = 1024

// ── Interactive: list ───────────────────────────────────────────────────────
// docs: interactive-list-messages — "up to 10 sections, with up to 10 rows for
// all sections combined".
export const LIST_ROW_MAX = 10
export const LIST_SECTION_MAX = 10
// docs: same page — "Button label text… Supports a single button. Maximum 20
// characters."
export const LIST_BUTTON_TEXT_MAX = 20
// docs: same page — "Row title… Maximum 24 characters."
export const LIST_ROW_TITLE_MAX = 24
// docs: same page — "Row description. Maximum 72 characters."
export const LIST_ROW_DESCRIPTION_MAX = 72
// docs: same page — "Section title text. Required… Maximum 24 characters."
// Required is the operative word: a section without a title is not valid.
export const LIST_SECTION_TITLE_MAX = 24
// docs: same page — "Arbitrary string identifying the row… Maximum 200 characters."
export const LIST_ROW_ID_MAX = 200
// docs: same page — "Message body text. Supports URLs. Maximum 4096 characters."
export const LIST_BODY_MAX = 4096

// ── Interactive: cta_url ────────────────────────────────────────────────────
// docs: interactive-cta-url-messages — "Button label text… Maximum 20 characters."
export const CTA_TEXT_MAX = 20
// docs: same page — "Body text… Maximum 1024 characters."
export const CTA_BODY_MAX = 1024

// ── Header / footer text, shared by the interactive types ───────────────────
// docs: interactive-list-messages ("Supports `text` header type only. Maximum
// 60 characters") and interactive-cta-url-messages ("Header text. Maximum 60").
export const HEADER_TEXT_MAX = 60
// docs: interactive-reply-buttons-messages / cta — "Footer text… Maximum 60."
export const FOOTER_TEXT_MAX = 60

// ── Interactive: media carousel ─────────────────────────────────────────────
// docs: interactive-media-carousel-messages — "Messages must include between 2
// and 10 cards."
export const CAROUSEL_CARD_MIN = 2
export const CAROUSEL_CARD_MAX = 10
// docs: same page — "Main message body text. Maximum 1024 characters."
export const CAROUSEL_BODY_MAX = 1024
// docs: same page — "Card body text. Max 160 characters, and up to 2 line breaks."
export const CAROUSEL_CARD_BODY_MAX = 160
export const CAROUSEL_CARD_LINE_BREAK_MAX = 2
// docs: same page — quick-reply and URL button labels are both "Maximum 20".
export const CAROUSEL_BUTTON_TEXT_MAX = 20
// docs: same page — "Quick-reply button ID. Maximum 256 characters."
export const QUICK_REPLY_ID_MAX = 256
// assumed: the docs say a card carries "one or more quick-reply buttons" and
// give no ceiling. Meta's own example uses two, so two is what we allow.
export const CAROUSEL_REPLY_MAX = 2

// ── Location ────────────────────────────────────────────────────────────────
// docs: location-messages — body text max is 1024 on the request message.
export const LOCATION_REQUEST_BODY_MAX = 1024
// assumed: location-messages documents `name` and `address` as optional strings
// with NO stated maximum. These are our own caps, chosen so a pin's label stays
// readable on a phone — not Meta limits. Raise them freely.
export const LOCATION_NAME_MAX = 60
export const LOCATION_ADDRESS_MAX = 200
