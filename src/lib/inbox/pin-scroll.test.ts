import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { pinScrollFromBottom } from "@/lib/inbox/pin-scroll"

/**
 * A scroller, reduced to what the pin touches: a height that grows when content
 * is inserted, a scroll position, and a scroll event nobody dispatches for us.
 */
function makeViewport() {
  const listeners = new Map<string, Set<() => void>>()
  const content = {}

  // Clamped the way a real scroller is: assigning past the end lands on the
  // end. `toBottom` is built on exactly that, so a fake that let `scrollTop`
  // run past `scrollHeight` would prove nothing.
  let scrollTop = 400

  const viewport = {
    scrollHeight: 1000,
    /** 1000 tall, 600 visible → the bottom is scrollTop 400. */
    clientHeight: 600,
    get scrollTop() {
      return scrollTop
    },
    set scrollTop(value: number) {
      const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
      scrollTop = Math.min(Math.max(0, value), max)
    },
    firstElementChild: content,
    addEventListener(type: string, fn: () => void) {
      const set = listeners.get(type) ?? new Set()
      set.add(fn)
      listeners.set(type, set)
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn)
    },
    /** Content added above, the way a prepended page arrives. */
    grow(px: number) {
      viewport.scrollHeight += px
      fireResize()
    },
    /** The pane around the scroller settling — the composer, its hint line. */
    resizeViewport(px: number) {
      viewport.clientHeight += px
      // Re-assert the clamp: a shorter scroll range pulls `scrollTop` back the
      // way the browser would.
      viewport.scrollTop = scrollTop
      fireResize()
    },
    /** The reader turning the wheel. */
    scrollBy(px: number) {
      viewport.scrollTop += px
      viewport.emit("scroll")
    },
    emit(type: string) {
      for (const fn of listeners.get(type) ?? []) fn()
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0
    },
  }

  return viewport
}

let fireResize: () => void = () => {}
let disconnected = 0

beforeEach(() => {
  disconnected = 0
  class FakeResizeObserver {
    private live = true
    constructor(private cb: () => void) {
      // A disconnected observer stops delivering, like the real one — otherwise
      // the fake would keep pinning after release and hide the bug it is here
      // to catch.
      fireResize = () => {
        if (this.live) this.cb()
      }
    }
    observe() {}
    disconnect() {
      if (!this.live) return
      this.live = false
      disconnected += 1
    }
  }
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver
})

afterEach(() => {
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver
})

describe("pinScrollFromBottom", () => {
  it("keeps the same distance from the bottom when content is added above", () => {
    const vp = makeViewport()
    // 1000 tall, scrolled to 400 → the reader is 600 from the bottom.
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement)

    vp.grow(250)

    assert.equal(vp.scrollTop, 650, "scrollTop follows the insertion")
    assert.equal(vp.scrollHeight - vp.scrollTop, 600, "distance from bottom held")
    pin.release()
  })

  it("holds through several growths — the spinner, the page, then its photos", () => {
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement)

    vp.grow(40) // spinner
    vp.grow(900) // the page itself
    vp.grow(192) // a photo decoding afterwards

    assert.equal(vp.scrollHeight - vp.scrollTop, 600)
    assert.ok(pin.active)
    pin.release()
  })

  it("lets go the moment the reader scrolls themselves", () => {
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement)

    vp.scrollBy(-120)
    assert.equal(pin.active, false)

    vp.grow(500)
    assert.equal(vp.scrollTop, 280, "left exactly where the reader put it")
  })

  it("does not mistake its own correction for the reader", () => {
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement)

    vp.grow(300)
    vp.emit("scroll") // the browser's event for the scrollTop the pin just set
    assert.ok(pin.active, "still pinned")
    pin.release()
  })

  it("releases when the content stops moving", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement, { idleMs: 400 })

    vp.grow(100)
    t.mock.timers.tick(399)
    assert.ok(pin.active)
    t.mock.timers.tick(2)
    assert.equal(pin.active, false)
  })

  it("gives up on content that never settles", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement, {
      idleMs: 1_000,
      maxMs: 3_000,
    })

    // A resize every 500ms would keep the idle timer alive forever.
    for (let i = 0; i < 6; i++) {
      t.mock.timers.tick(500)
      if (pin.active) vp.grow(10)
    }
    assert.equal(pin.active, false, "the cap ends it")
  })

  it("holds indefinitely when both timers are off — the landing pin", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement, {
      idleMs: null,
      maxMs: null,
    })

    // A thread settles in bursts far enough apart to outlive any useful idle
    // timer: a carousel measures, then a photo decodes a second later.
    vp.grow(200)
    t.mock.timers.tick(60_000)
    assert.ok(pin.active, "still holding long after a capped pin would have gone")

    vp.grow(150)
    t.mock.timers.tick(60_000)
    assert.ok(pin.active)
    assert.equal(vp.scrollTop, vp.scrollHeight - 600, "still the same distance up")

    pin.release()
  })

  const remaining = (vp: { scrollHeight: number; scrollTop: number; clientHeight: number }) =>
    vp.scrollHeight - vp.scrollTop - vp.clientHeight

  it("holds the bottom itself, not a distance, when asked to", () => {
    const vp = makeViewport()
    vp.scrollTop = vp.scrollHeight // landing: ask for the bottom
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement, {
      toBottom: true,
      idleMs: null,
      maxMs: null,
    })

    vp.grow(300)
    assert.equal(remaining(vp), 0, "still at the bottom after content arrives")

    // The pane around the scroller settles too: the composer resolves, its hint
    // wraps, and the viewport loses height. The distance that was right a moment
    // ago is now wrong, and only re-asking for the bottom stays correct.
    vp.resizeViewport(-40)
    assert.equal(remaining(vp), 0, "still at the bottom after the viewport changes")
    pin.release()
  })

  it("does not read the browser's own clamping as the reader, in bottom mode", () => {
    const vp = makeViewport()
    vp.scrollTop = vp.scrollHeight
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement, {
      toBottom: true,
      idleMs: null,
      maxMs: null,
    })

    // A viewport that grows shrinks the scroll range, so the browser pulls
    // `scrollTop` back on its own and fires a scroll for it. That is not
    // somebody reading — it leaves us exactly where we were, at the bottom.
    vp.resizeViewport(120)
    vp.emit("scroll")
    assert.ok(pin.active, "still holding")
    assert.equal(remaining(vp), 0)
    pin.release()
  })

  it("still lets the reader take over when the timers are off", () => {
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement, {
      idleMs: null,
      maxMs: null,
    })

    vp.scrollBy(-120)
    assert.equal(pin.active, false, "the reader always wins")
  })

  it("cleans up after itself, and release is safe to call twice", () => {
    const vp = makeViewport()
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement)
    assert.equal(vp.listenerCount("scroll"), 1)

    pin.release()
    pin.release()

    assert.equal(vp.listenerCount("scroll"), 0)
    assert.equal(disconnected, 1, "disconnected once, not twice")
  })

  it("calls back once when it lets go", () => {
    const vp = makeViewport()
    let released = 0
    const pin = pinScrollFromBottom(vp as unknown as HTMLElement, {
      onRelease: () => {
        released += 1
      },
    })

    pin.release()
    pin.release()
    assert.equal(released, 1)
  })
})
