/**
 * Finding the `@` the author is currently typing.
 *
 * Pure, and separate from the component on purpose: the whole feature turns on
 * getting this one predicate right, and it is the part with real edge cases —
 * an email address is not a mention, a caret parked before an old mention is
 * not a mention, and a space ends one. A component test cannot exercise those
 * as precisely as a function test can.
 */

export interface ActiveMention {
  /** Index of the `@`, so the caller knows what to replace. */
  start: number
  /** Text typed after the `@`, used to filter the list. */
  query: string
}

/** Characters allowed in a tool name, and therefore in a mention query. */
const QUERY_CHAR = /[\w.-]/

/**
 * The `@` only opens a mention at the start of a word. Anything else means it
 * is punctuation inside text — `user@example.com` being the case that matters.
 */
function opensMention(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char)
}

/**
 * The mention being typed at `caret`, or null when there is none.
 *
 * Scans backwards from the caret so it works mid-document, not only at the end
 * of the value.
 */
export function findActiveMention(
  value: string,
  caret: number,
): ActiveMention | null {
  if (caret < 0 || caret > value.length) return null

  for (let index = caret - 1; index >= 0; index--) {
    const char = value[index]

    if (char === "@") {
      if (!opensMention(value[index - 1])) return null
      return { start: index, query: value.slice(index + 1, caret) }
    }

    // A character a tool name could not contain ends the search: the caret is
    // in ordinary prose, not in a mention.
    if (!QUERY_CHAR.test(char)) return null
  }

  return null
}

/**
 * Replace the mention at `start` with `insert`, leaving the caret after it.
 *
 * Adds a trailing space so the author keeps typing a sentence rather than
 * landing glued to the token they just picked.
 */
export function applyMention(
  value: string,
  mention: ActiveMention,
  insert: string,
): { value: string; caret: number } {
  const head = value.slice(0, mention.start)
  const tail = value.slice(mention.start + 1 + mention.query.length)
  const text = tail.startsWith(" ") ? insert : `${insert} `

  return {
    value: head + text + tail,
    // Past the token *and* its space, whether that space was already there or
    // we just added it — either way the next character typed starts a word.
    caret: head.length + insert.length + 1,
  }
}

/** How a picked tool is written into the prompt. */
export function mentionText(toolName: string): string {
  return `\`${toolName}\``
}
