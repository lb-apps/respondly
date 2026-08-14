/**
 * What a rich message the assistant already sent looks like in its own history.
 *
 * Only the text of a past turn used to come back to the model. A carousel came
 * back as its `body` and nothing else; a set of photos, which has no body at
 * all, came back as nothing. So the model could not see that it had sent a
 * carousel, could not see where the photos landed relative to its words, and —
 * having no evidence either way — kept guessing that whatever it queued had
 * arrived first.
 *
 * These lines are the missing evidence. One per message, in the order the
 * messages were sent, in the same English the instructions are written in, so
 * they read as annotation rather than as something the customer said.
 *
 * Pure; no `server-only`.
 */

/** Keeps a summary from growing into a second copy of the message. */
const MAX_ITEMS = 3
const MAX_LABEL = 32

function clampLabel(value: string): string {
  // A carousel card's body is a small block — name, capacity, price, a line of
  // description. Its first line is what the option is called; the rest would
  // turn a one-line reminder back into the message it is summarising.
  const text = value.split("\n")[0]!.trim().replace(/\s+/g, " ")
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text
}

function list(labels: string[]): string {
  const kept = labels.filter(Boolean).slice(0, MAX_ITEMS).map(clampLabel)
  if (kept.length === 0) return ""
  const rest = labels.length - kept.length
  return rest > 0 ? `${kept.join(", ")}, +${rest} more` : kept.join(", ")
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function labelsOf(value: unknown, key: string): string[] {
  const items = Array.isArray(value) ? value : []
  const out: string[] = []
  for (const item of items) {
    const record = asRecord(item)
    const label = record?.[key]
    if (typeof label === "string" && label.trim()) out.push(label)
  }
  return out
}

/**
 * A one-line description of what this message actually was, or null when the
 * message was plain text and its own words already say everything.
 */
export function summarizeRichContent(richContent: unknown): string | null {
  const items = Array.isArray(richContent) ? richContent : []
  if (items.length === 0) return null

  const parts: string[] = []
  let images = 0

  for (const item of items) {
    const rich = asRecord(item)
    const type = rich?.type
    if (typeof type !== "string") continue

    switch (type) {
      case "image":
        images += 1
        break
      case "carousel": {
        const names = list(labelsOf(rich?.cards, "body"))
        parts.push(names ? `a carousel (${names})` : "a carousel")
        break
      }
      case "choice": {
        const names = list(labelsOf(rich?.options, "label"))
        parts.push(names ? `an option list (${names})` : "an option list")
        break
      }
      case "cta": {
        const label = typeof rich?.buttonLabel === "string" ? rich.buttonLabel : ""
        parts.push(label ? `a link button ("${clampLabel(label)}")` : "a link button")
        break
      }
      case "location":
        parts.push("a map pin")
        break
      case "location_request":
        parts.push("a request for the customer's location")
        break
      case "quick_reply": {
        const buttons = Array.isArray(rich?.buttons) ? rich.buttons : []
        const names = list(buttons.filter((b): b is string => typeof b === "string"))
        parts.push(names ? `reply buttons (${names})` : "reply buttons")
        break
      }
    }
  }

  if (images > 0) {
    parts.unshift(images === 1 ? "a photo" : `${images} photos`)
  }
  if (parts.length === 0) return null

  return `[you sent ${parts.join(" and ")} here]`
}
