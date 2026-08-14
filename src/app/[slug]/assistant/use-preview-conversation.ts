"use client"

import { useCallback, useRef, useState, type MutableRefObject } from "react"
import type { UIMessage } from "ai"
import { TURN_DEBOUNCE_MS } from "@/lib/assistant/turn-debounce"
import { savePreviewAssistantMessageAction } from "./preview-actions"

function extractTextParts(parts: unknown[]): string {
  return parts
    .filter(
      (p): p is Record<string, unknown> =>
        typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "text"
    )
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n\n")
}

type PreviewStatus = "ready" | "submitted"

/**
 * Preview conversation — WhatsApp parity:
 * - 4s silence after the last user message before calling the API (batching)
 * - "yazıyor…" only while agent.generate() runs, not during the silence window
 * - a new user message resets the timer and aborts any in-flight generation
 */
/** Delay before re-fetching the session list to reveal the server-generated title. */
const TITLE_REVEAL_DELAY_MS = 2500

export function usePreviewConversation(args: {
  assistantId: string | null
  organizationId: string
  sessionIdRef: MutableRefObject<string | null>
  onSessionsMutate: () => void
  onReplyError?: () => void
}) {
  const { assistantId, organizationId, sessionIdRef, onSessionsMutate, onReplyError } = args
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [status, setStatus] = useState<PreviewStatus>("ready")
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const busy = status === "submitted"

  const clearScheduledReply = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    clearScheduledReply()
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("ready")
  }, [clearScheduledReply])

  const appendUserMessage = useCallback((message: UIMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const runAssistantReply = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!assistantId || !sid) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus("submitted")

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId, sessionId: sid }),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const data = (await res.json()) as { message: UIMessage }
      const assistantMessage = data.message

      setMessages((prev) => [...prev, assistantMessage])

      const body = extractTextParts(assistantMessage.parts as unknown[])
      await savePreviewAssistantMessageAction({
        sessionId: sid,
        organizationId,
        role: "assistant",
        body,
        parts: assistantMessage.parts as unknown[],
      })
      onSessionsMutate()
      // The server titles the session via after() once the response flushes; refetch shortly
      // after to reveal it. Idempotent server-side, so re-firing on later turns is harmless.
      if (titleRevealRef.current) clearTimeout(titleRevealRef.current)
      titleRevealRef.current = setTimeout(() => {
        titleRevealRef.current = null
        onSessionsMutate()
      }, TITLE_REVEAL_DELAY_MS)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return
      }
      throw err
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setStatus("ready")
      }
    }
  }, [assistantId, organizationId, onSessionsMutate, sessionIdRef])

  const scheduleAssistantReply = useCallback(() => {
    clearScheduledReply()
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("ready")

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void runAssistantReply().catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        onReplyError?.()
      })
    }, TURN_DEBOUNCE_MS)
  }, [clearScheduledReply, onReplyError, runAssistantReply])

  const resetConversation = useCallback(() => {
    clearScheduledReply()
    abortRef.current?.abort()
    abortRef.current = null
    if (titleRevealRef.current) {
      clearTimeout(titleRevealRef.current)
      titleRevealRef.current = null
    }
    setStatus("ready")
    setMessages([])
  }, [clearScheduledReply])

  const bindSession = useCallback(
    (sessionId: string | null) => {
      sessionIdRef.current = sessionId
    },
    [sessionIdRef]
  )

  return {
    messages,
    setMessages,
    status,
    busy,
    stop,
    appendUserMessage,
    scheduleAssistantReply,
    resetConversation,
    bindSession,
  }
}
