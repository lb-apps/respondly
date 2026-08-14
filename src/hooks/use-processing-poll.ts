import { useEffect, useRef } from "react"

const INITIAL_MS = 3_000
const MAX_MS = 30_000
/** Align with knowledge-ingest cron stuck threshold. */
const MAX_DURATION_MS = 10 * 60 * 1000

/**
 * Poll while background jobs run (e.g. knowledge indexing). Backoff + cap so a
 * stuck `processing` row cannot hammer `router.refresh()` forever.
 */
export function useProcessingPoll(active: boolean, onPoll: () => void) {
  const onPollRef = useRef(onPoll)
  useEffect(() => {
    onPollRef.current = onPoll
  }, [onPoll])

  useEffect(() => {
    if (!active) return

    const started = Date.now()
    let delay = INITIAL_MS
    let timeout: ReturnType<typeof setTimeout>

    const schedule = () => {
      timeout = setTimeout(tick, delay)
    }

    const tick = () => {
      if (Date.now() - started > MAX_DURATION_MS) return
      if (!document.hidden) {
        onPollRef.current()
        delay = Math.min(Math.round(delay * 1.5), MAX_MS)
      }
      schedule()
    }

    schedule()
    return () => clearTimeout(timeout)
  }, [active])
}
