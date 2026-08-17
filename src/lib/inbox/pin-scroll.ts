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
  /**
   * Release after this long with no resize. `null` never releases on its own —
   * for the landing pin, where the only thing that should end the hold is the
   * reader taking over. A thread settles in bursts (a carousel measures, then an
   * image decodes a second later), and any timer short enough to be useful is
   * short enough to fire inside one of those gaps.
   */
  idleMs?: number | null
  /**
   * Release regardless after this long — a broken image never settles. `null`
   * for no cap.
   */
  maxMs?: number | null
  /** How far the scroller may drift from our own value before we call it the reader's doing. */
  toleratePx?: number
  /**
   * Hold the very bottom rather than the distance the reader is currently at.
   *
   * The two are not the same thing once the viewport itself can change height:
   * a distance measured in one layout is the wrong distance in the next, and
   * the thread lands a little short of its newest message. Landing pins want
   * this; a history insert does not, because there the whole point is to keep
   * the reader exactly where they were.
   */
  toBottom?: boolean
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
    toBottom = false,
    onRelease,
  } = options

  const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop
  // What we last set. Anything else means the scroll came from the reader.
  let ours = viewport.scrollTop
  let active = true
  let idle: ReturnType<typeof setTimeout> | null = null

  const apply = () => {
    // Assigning past the maximum is how you ask for "the bottom, whatever that
    // is now" — the browser clamps, and it stays right even if the viewport
    // changed height since the pin was taken.
    viewport.scrollTop = toBottom
      ? viewport.scrollHeight
      : viewport.scrollHeight - distanceFromBottom
    ours = viewport.scrollTop
  }

  const onScroll = () => {
    if (toBottom) {
      // Judge by where we ended up, not by who moved us. While the pane is
      // still settling the browser clamps `scrollTop` on its own — a viewport
      // that changes height re-bounds the scroll range — and comparing against
      // the last value we set read those clamps as the reader taking over,
      // which retired the pin before the thread had finished growing. Sitting
      // at the bottom is sitting at the bottom, whoever put us there; only
      // leaving it is the reader's doing.
      if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > toleratePx) {
        release()
      }
      return
    }
    if (Math.abs(viewport.scrollTop - ours) > toleratePx) release()
  }

  const observer = new ResizeObserver(() => {
    apply()
    if (idle) clearTimeout(idle)
    if (idleMs !== null) idle = setTimeout(release, idleMs)
  })

  // For a history insert the viewport's own box does not change; its content's
  // does. A landing pin has to watch both: the pane around the scroller is
  // still settling too — the composer resolves its height, its hint line wraps
  // — and a viewport that loses height moves the bottom without the content
  // having grown by a pixel. Watching only the content left the thread a couple
  // of dozen pixels short, with no further resize coming to correct it.
  const content = viewport.firstElementChild
  if (content) observer.observe(content)
  if (toBottom) observer.observe(viewport)

  const cap = maxMs !== null ? setTimeout(release, maxMs) : null
  viewport.addEventListener("scroll", onScroll, { passive: true })

  function release() {
    if (!active) return
    active = false
    observer.disconnect()
    if (idle) clearTimeout(idle)
    if (cap) clearTimeout(cap)
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
