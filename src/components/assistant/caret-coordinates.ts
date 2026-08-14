/**
 * Where the caret is, in pixels, inside a textarea.
 *
 * The platform does not expose this: a textarea has a selection index but no
 * geometry for it. The standard workaround is to render the same text, in the
 * same font and the same width, into a hidden element and measure where the
 * caret lands there. It is a measurement, not a heuristic — the mirror uses the
 * textarea's own computed styles, so wrapping matches exactly.
 *
 * Worth the trouble here because the prompt editor is tall and scrolls: a
 * suggestion list pinned to the bottom of the box would float far away from the
 * word being typed.
 */

/** Everything that can change where a glyph lands. */
const MIRRORED: Array<keyof CSSStyleDeclaration> = [
  "boxSizing",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderTopWidth",
  "fontFamily",
  "fontSize",
  "fontStretch",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "tabSize",
  "textIndent",
  "textTransform",
  "wordSpacing",
]

export interface CaretPosition {
  /** Offset from the textarea's top-left, already corrected for scrolling. */
  top: number
  left: number
  /** Line height, so a caller can place something below the line, not over it. */
  height: number
}

export function caretCoordinates(
  textarea: HTMLTextAreaElement,
  caret: number,
): CaretPosition {
  const computed = window.getComputedStyle(textarea)
  const mirror = document.createElement("div")

  for (const property of MIRRORED) {
    mirror.style.setProperty(
      String(property).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      computed.getPropertyValue(
        String(property).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      ),
    )
  }

  // Off-screen, but laid out — `display: none` would measure nothing.
  mirror.style.position = "absolute"
  mirror.style.visibility = "hidden"
  mirror.style.top = "0"
  mirror.style.left = "-9999px"
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.height = "auto"
  mirror.style.overflow = "hidden"
  // A textarea wraps like `pre-wrap`, and preserves the trailing spaces that
  // decide whether the caret sits at the end of a line or the start of the next.
  mirror.style.whiteSpace = "pre-wrap"
  mirror.style.overflowWrap = "break-word"

  mirror.textContent = textarea.value.slice(0, caret)

  // A zero-width element has no position of its own; give it something to be.
  const marker = document.createElement("span")
  marker.textContent = textarea.value.slice(caret) || "."
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const top = marker.offsetTop - textarea.scrollTop
  const left = marker.offsetLeft - textarea.scrollLeft
  const height = parseFloat(computed.lineHeight) || marker.offsetHeight
  document.body.removeChild(mirror)

  return { top, left, height }
}
