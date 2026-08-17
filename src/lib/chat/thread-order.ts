import type { ThreadRow } from "@/components/chat/thread-view"

/**
 * Where a turn's own events sit in the thread.
 *
 * Timestamps put them in the wrong place. A tool runs in the middle of a turn,
 * so the row it writes is stamped *before* the reply — which the surface only
 * saves once the turn has finished. Sorted by time, "the assistant updated the
 * contact card" lands between the customer's question and the answer to it, as
 * if the card changed before anyone had said anything.
 *
 * Read the other way round it is obvious: the assistant answered, and while
 * answering it learned something. So an event the assistant caused slides down
 * past the reply it came with, and is reported after it.
 *
 * Only the assistant's own events move. A teammate editing the contact card in
 * the inbox has no reply attached to it, and its timestamp is already the truth.
 */

function isAssistantMessage(row: ThreadRow): boolean {
  return row.kind === "message" && row.author.kind === "assistant"
}

/** An event with no sender is one the assistant caused; a teammate has a name. */
function isAssistantEvent(row: ThreadRow): boolean {
  return row.kind === "event" && row.sender === null
}

export function orderTurnEvents(rows: readonly ThreadRow[]): ThreadRow[] {
  const out = [...rows]

  for (let i = 0; i < out.length; i++) {
    if (!isAssistantEvent(out[i]!)) continue

    // Walk it down over the reply — or replies, when a turn sent several.
    let at = i
    while (at + 1 < out.length && isAssistantMessage(out[at + 1]!)) {
      const event = out[at]!
      out[at] = out[at + 1]!
      out[at + 1] = event
      at++
    }
  }

  return out
}
