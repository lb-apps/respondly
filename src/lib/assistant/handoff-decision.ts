/**
 * When a conversation stops being the assistant's to answer.
 *
 * The assistant draws on two sources: the knowledge base (how this business
 * works — policies, house rules, services) and the connected live systems
 * (what is true right now — availability, prices, status). They are
 * complementary, not ranked, and a question answered by one does not need the
 * other.
 *
 * The rule that follows from that: hand off when every source it consulted came
 * back empty, not when any single one did. A booking system going down must not
 * bury a question the knowledge base answers completely.
 *
 * Pure function so the decision is testable on its own — it is the difference
 * between a guest being answered and a guest waiting for staff.
 */

export interface TurnGroundingSignals {
  /** The assistant searched the knowledge base this turn. */
  knowledgeSearched: boolean
  /** …and it returned at least one passage. */
  knowledgeFound: boolean
  /** The assistant called at least one tool from a connected system. */
  mcpToolCalled: boolean
  /** …and at least one of those returned real data rather than an error. */
  mcpToolSucceeded: boolean
  /** The turn produced no reply text and no rich message. */
  saidNothing: boolean
}

export interface HandoffDecision {
  handOff: boolean
  /** Why, for the log. Empty when the assistant is keeping the conversation. */
  reason: string
}

export function decideHandoff(signals: TurnGroundingSignals): HandoffDecision {
  // Silence is never an acceptable reply, whatever the tools managed to do.
  if (signals.saidNothing) {
    return { handOff: true, reason: "assistant produced no reply" }
  }

  const consulted = signals.knowledgeSearched || signals.mcpToolCalled
  if (!consulted) {
    // Greetings, chitchat, "thanks" — nothing to ground, nothing to escalate.
    return { handOff: false, reason: "" }
  }

  const grounded = signals.knowledgeFound || signals.mcpToolSucceeded
  if (grounded) return { handOff: false, reason: "" }

  return {
    handOff: true,
    reason:
      `knowledge ${
        signals.knowledgeSearched ? "empty" : "not searched"
      }, systems ${signals.mcpToolCalled ? "all failed" : "not called"}`,
  }
}

/** True when a live system failed but the reply stood on its other source. */
export function survivedSystemFailure(
  signals: TurnGroundingSignals & { mcpToolFailed: boolean }
): boolean {
  return signals.mcpToolFailed && !decideHandoff(signals).handOff
}
