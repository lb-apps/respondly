/**
 * The moments a conversation changes hands.
 *
 * `closed` is deliberately not here. Closing ends a conversation rather than
 * passing it to someone, and nothing takes it back afterwards.
 *
 * See `./index.ts` for how these reach the thread; the storage contract they
 * share with every other event is documented there and on the `messages.role`
 * column COMMENT.
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

export const HANDOFF_KINDS: readonly string[] = [
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
 * Read a handoff back out of an event payload.
 *
 * `record` is `metadata.event`, already unwrapped and already known to carry a
 * string `kind` — `parseThreadEvent` owns that much, because it is the part
 * every event family has in common.
 */
export function parseHandoffPayload(
  record: Record<string, unknown>
): HandoffEvent | null {
  const kind = record.kind
  if (typeof kind !== "string" || !HANDOFF_KINDS.includes(kind)) return null

  const reason = record.reason
  return {
    kind: kind as HandoffEventKind,
    ...(typeof reason === "string" && REASONS.includes(reason)
      ? { reason: reason as HandoffReason }
      : {}),
  }
}
