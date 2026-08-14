/**
 * Shared reader for the `ask_choice` tool result.
 *
 * The dashboard preview and the WhatsApp sender must agree on what the model
 * asked for, so both build their bubble from this one pure function rather
 * than each re-parsing the tool payload. No I/O, no server-only imports.
 */

export interface ChoiceOptionView {
  id: string
  label: string
  description?: string
  group?: string
}

export interface ChoiceMessage {
  type: "choice"
  body: string
  options: ChoiceOptionView[]
  listButtonLabel?: string
  footer?: string
  /**
   * The descriptions carry information the labels do not — a price, a duration,
   * a condition. Reply buttons have no room for a description, so a choice like
   * that must go out as a list however few options there are.
   */
  descriptionsMatter?: boolean
}

/** Options at or below this count render as tappable buttons; above, as a list. */
export const CHOICE_BUTTON_LIMIT = 3
/** Meta's hard ceiling on list rows. */
export const CHOICE_OPTION_LIMIT = 10

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readOptions(value: unknown): ChoiceOptionView[] {
  if (!Array.isArray(value)) return []
  const out: ChoiceOptionView[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "object" || entry === null) continue
    const record = entry as Record<string, unknown>
    const label = str(record.label)
    if (!label) continue
    const description = str(record.description)
    const group = str(record.group)
    out.push({
      id: str(record.id) || `opt_${index}`,
      label,
      ...(description ? { description } : {}),
      ...(group ? { group } : {}),
    })
    if (out.length >= CHOICE_OPTION_LIMIT) break
  }
  return out
}

/** Build a choice bubble from an `ask_choice` tool result, or null if unusable. */
export function toChoiceMessage(
  output: Record<string, unknown> | null | undefined
): ChoiceMessage | null {
  if (!output) return null
  const body = str(output.body)
  const options = readOptions(output.options)
  if (!body || options.length === 0) return null

  const listButtonLabel = str(output.listButtonLabel)
  const footer = str(output.footer)
  const descriptionsMatter = output.descriptionsMatter === true

  return {
    type: "choice",
    body,
    options,
    ...(listButtonLabel ? { listButtonLabel } : {}),
    ...(footer ? { footer } : {}),
    ...(descriptionsMatter ? { descriptionsMatter } : {}),
  }
}

/**
 * Which WhatsApp component this choice will be delivered as.
 *
 * Count decides by default — three answers or fewer fit as buttons. But buttons
 * render a label and nothing else, so a choice whose descriptions carry the
 * actual information (two rooms that differ only by price) has to be a list
 * even when it would otherwise fit: a button-shaped version of it would drop
 * the prices without saying so.
 */
export function choiceTransport(
  options: ChoiceOptionView[],
  descriptionsMatter = false
): "buttons" | "list" {
  if (descriptionsMatter && options.some((option) => option.description)) {
    return "list"
  }
  return options.length <= CHOICE_BUTTON_LIMIT ? "buttons" : "list"
}
