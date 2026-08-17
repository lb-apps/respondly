import {
  handoffEventText,
  parseHandoffPayload,
  type HandoffEvent,
} from "./handoff"
import {
  contactProfileEventHeading,
  parseContactProfilePayload,
  type ContactProfileUpdatedEvent,
} from "./contact-profile"

/**
 * The things that happen in a conversation without anyone saying anything.
 *
 * They are stored as `messages` rows with `role: "system"` — see the column's
 * COMMENT. That keeps one ordered stream: the thread's keyset pagination, its
 * realtime subscription and `mergeThreadMessages` all reach an event the same
 * way they reach a message, and `getConversationHistory` (guest/assistant/staff
 * only) keeps them out of the model's context. A `system` row is also refused
 * by `sync_conversation_last_message`, so an event never becomes a
 * conversation's preview or moves it up the inbox list.
 *
 * Each family owns its own payload, its own labels and its own parser in a file
 * next to this one. What lives here is only what they share: how an event is
 * found in a row, and that an unrecognised one is nothing at all.
 */
export type ThreadEvent = HandoffEvent | ContactProfileUpdatedEvent

export type {
  HandoffEvent,
  HandoffEventKind,
  HandoffReason,
} from "./handoff"
export type {
  ContactProfileChange,
  ContactProfileField,
  ContactProfileSnapshot,
  ContactProfileUpdatedEvent,
} from "./contact-profile"
export {
  CONTACT_PROFILE_COLUMNS,
  CONTACT_PROFILE_FIELDS,
  CONTACT_PROFILE_LABELS,
  MAX_EVENT_VALUE_CHARS,
  contactProfileChangeText,
  contactProfileEventText,
  diffContactProfile,
  formatContactProfileValue,
} from "./contact-profile"
export { handoffEventText } from "./handoff"

/**
 * Read an event back out of a message's metadata.
 *
 * Anything unrecognised is `null`, not a guess: a row written by an older or
 * newer version of this directory must render as nothing rather than as the
 * wrong event. `kind` is the discriminant and the only thing read before the
 * payload is handed to the family that owns it.
 */
export function parseThreadEvent(metadata: unknown): ThreadEvent | null {
  if (typeof metadata !== "object" || metadata === null) return null
  const event = (metadata as Record<string, unknown>).event
  if (typeof event !== "object" || event === null) return null

  const record = event as Record<string, unknown>
  if (typeof record.kind !== "string") return null

  switch (record.kind) {
    case "handoff_to_human":
    case "takeover":
    case "returned_to_assistant":
      return parseHandoffPayload(record)
    case "contact_profile_updated":
      return parseContactProfilePayload(record)
    default:
      return null
  }
}

/**
 * The sentence an event is, as the thread reads it today.
 *
 * `actor` is who caused it: `null` for the assistant, and the teammate's
 * profile otherwise — resolved at read time, so a teammate who has since filled
 * in their name is named on events that predate it.
 */
export function threadEventText(
  event: ThreadEvent,
  actor: { name?: string | null } | null
): string {
  switch (event.kind) {
    case "contact_profile_updated":
      // Heading only: the divider draws the fields as chips right under it.
      return contactProfileEventHeading(actor)
    default:
      return handoffEventText(event.kind, actor?.name)
  }
}
