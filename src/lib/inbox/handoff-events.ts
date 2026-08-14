/**
 * The moments a conversation changes hands, as the thread shows them.
 *
 * They are stored as `messages` rows with `role: "system"` — see the column's
 * COMMENT. That keeps one ordered stream: the thread's keyset pagination, its
 * realtime subscription and `mergeThreadMessages` all reach an event the same
 * way they reach a message, and `getConversationHistory` (guest/assistant/staff
 * only) keeps them out of the model's context.
 *
 * `closed` is deliberately not here. Closing ends a conversation rather than
 * passing it to someone, and nothing takes it back afterwards.
 */
export type HandoffEventKind =
  | "handoff_to_human"
  | "takeover"
  | "returned_to_assistant"

/** Why the assistant handed over, when it did. Never shown raw to the team. */
export type HandoffReason =
  | "assistant_escalated"
  | "turn_failed"
  | "no_credentials"

export interface HandoffEvent {
  kind: HandoffEventKind
  reason?: HandoffReason
}

const KINDS: readonly string[] = [
  "handoff_to_human",
  "takeover",
  "returned_to_assistant",
]

const REASONS: readonly string[] = [
  "assistant_escalated",
  "turn_failed",
  "no_credentials",
]

/**
 * The one sentence an event is, written twice over: into the row's `body` when
 * it happens, and onto the divider when the thread is read.
 *
 * Both come from here so they cannot say different things — the stored copy
 * carries every surface that only knows how to show a message, while the
 * rendered one can name the teammate from their profile as it stands today.
 *
 * `reason` never appears. The team needs to know a person is needed, not that
 * a tool call threw.
 */
export function handoffEventText(
  kind: HandoffEventKind,
  actorName?: string | null
): string {
  const who = actorName?.trim()

  switch (kind) {
    case "handoff_to_human":
      return "Asistan konuşmayı ekibe devretti"
    case "takeover":
      return who ? `${who} konuşmayı devraldı` : "Konuşma ekip tarafından devralındı"
    case "returned_to_assistant":
      return who
        ? `${who} konuşmayı asistana geri verdi`
        : "Konuşma asistana geri verildi"
  }
}

/**
 * Read an event back out of a message's metadata.
 *
 * Anything unrecognised is `null`, not a guess: a row written by an older or
 * newer version of this file must render as nothing rather than as the wrong
 * event.
 */
export function parseHandoffEvent(metadata: unknown): HandoffEvent | null {
  if (typeof metadata !== "object" || metadata === null) return null
  const event = (metadata as Record<string, unknown>).event
  if (typeof event !== "object" || event === null) return null

  const record = event as Record<string, unknown>
  const kind = record.kind
  if (typeof kind !== "string" || !KINDS.includes(kind)) return null

  const reason = record.reason
  return {
    kind: kind as HandoffEventKind,
    ...(typeof reason === "string" && REASONS.includes(reason)
      ? { reason: reason as HandoffReason }
      : {}),
  }
}
