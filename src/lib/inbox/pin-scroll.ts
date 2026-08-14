/**
 * Hold a scroller still while content is inserted above the reader.
 *
 * Prepending a page of history moves everything the reader is looking at down
 * by the height of what arrived. Restoring `scrollTop` afterwards is not enough,
 * because the shift does not happen once: the spinner appears, then the page
 * lands, then every photo in it decodes and grows its box. Each of those is a
 * separate layout, and a single correction only covers whichever one it
 * happened to follow.
 *
 * So this pins the *distance from the bottom* — the one number the insertions
 * above do not change — and re-applies it on every resize until the content
 * stops moving.
 *
 * The reader wins immediately: any scroll that is not one of ours releases the
 * pin, so a pin can never fight someone who has taken over.
 */
export interface ScrollPin {
  /** Stop pinning. Safe to call more than once. */
  release(): void
  /** False once released, by settling, by timeout, or by the reader scrolling. */
  readonly active: boolean
}

export interface PinOptions {
  /** Release after this long with no resize. */
  idleMs?: number
  /** Release regardless after this long — a broken image never settles. */
  maxMs?: number
  /** How far the scroller may drift from our own value before we call it the reader's doing. */
  toleratePx?: number
  onRelease?: () => void
}

const DEFAULT_IDLE_MS = 400
const DEFAULT_MAX_MS = 10_000
const DEFAULT_TOLERATE_PX = 2

export function pinScrollFromBottom(
  viewport: HTMLElement,
  options: PinOptions = {}
): ScrollPin {
  const {
    idleMs = DEFAULT_IDLE_MS,
    maxMs = DEFAULT_MAX_MS,
    toleratePx = DEFAULT_TOLERATE_PX,
    onRelease,
  } = options

  const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop
  // What we last set. Anything else means the scroll came from the reader.
  let ours = viewport.scrollTop
  let active = true
  let idle: ReturnType<typeof setTimeout> | null = null

  const apply = () => {
    viewport.scrollTop = viewport.scrollHeight - distanceFromBottom
    ours = viewport.scrollTop
  }

  const onScroll = () => {
    if (Math.abs(viewport.scrollTop - ours) > toleratePx) release()
  }

  const observer = new ResizeObserver(() => {
    apply()
    if (idle) clearTimeout(idle)
    idle = setTimeout(release, idleMs)
  })

  // The viewport's own box does not change; its content's does.
  const content = viewport.firstElementChild
  if (content) observer.observe(content)

  const cap = setTimeout(release, maxMs)
  viewport.addEventListener("scroll", onScroll, { passive: true })

  function release() {
    if (!active) return
    active = false
    observer.disconnect()
    if (idle) clearTimeout(idle)
    clearTimeout(cap)
    viewport.removeEventListener("scroll", onScroll)
    onRelease?.()
  }

  return {
    release,
    get active() {
      return active
    },
  }
}
