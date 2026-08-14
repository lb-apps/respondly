"use client"

import { useServerInsertedHTML } from "next/navigation"
import { extractCss } from "goober"

/**
 * Ships `goober`'s stylesheet with the server-rendered HTML.
 *
 * `avvvatars` styles itself through goober, which writes its rules into the
 * document at runtime. On a server render there is no document, so the markup
 * arrives carrying class names and no rules — every generated avatar would show
 * as bare initials on a transparent square until hydration replaced it. This
 * hands the collected CSS to Next during SSR, the same way any runtime CSS-in-JS
 * library is wired into the App Router.
 *
 * Renders nothing on the client; there goober injects its own <style> tag.
 */
export function GooberStyles() {
  useServerInsertedHTML(() => {
    const css = extractCss()
    if (!css) return null
    return <style id="goober-ssr" dangerouslySetInnerHTML={{ __html: css }} />
  })

  return null
}
