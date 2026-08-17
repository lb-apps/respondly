"use client"

import { useRef } from "react"

/**
 * When each live preview message first appeared.
 *
 * A saved thread carries `created_at` from the database, but a message still
 * being typed into the preview has no timestamp anywhere — and without one the
 * byline under it collapses: the assistant's read "Asistan" with no clock, and
 * the tester's disappeared entirely, because a message with no time and no name
 * has no byline to draw. The inbox puts name and time under every bubble, so the
 * preview looked like a different product for as long as a session was live.
 *
 * Remembered per id rather than computed on the fly: a time derived at render
 * would tick forward on every keystroke, and the message would appear to have
 * been sent later and later the longer the session stayed open.
 */
export function useMessageTimestamps(): (id: string) => string {
  const seen = useRef(new Map<string, string>())

  return (id: string) => {
    const already = seen.current.get(id)
    if (already) return already
    const now = new Date().toISOString()
    seen.current.set(id, now)
    return now
  }
}
