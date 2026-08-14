"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  messagePreviewFromInsert,
  patchConversationFromRealtimeRow,
  sortInboxConversations,
} from "@/lib/inbox/list-utils"
import type { ConversationListItem } from "@/lib/supabase/queries/inbox"

interface UseInboxConversationListOptions {
  organizationId: string
  activeId: string | null
  serverConversations: ConversationListItem[]
  onRefresh: () => void
  debounceMs?: number
}

type MessageRow = {
  conversation_id: string
  created_at: string
  role: string
  body?: string | null
  type?: string | null
  metadata?: unknown
}

/**
 * Live inbox list: optimistic reorder + preview updates on Realtime events,
 * with a debounced RSC refresh to keep the open thread in sync.
 */
export function useInboxConversationList({
  organizationId,
  activeId,
  serverConversations,
  onRefresh,
  debounceMs = 400,
}: UseInboxConversationListOptions): ConversationListItem[] {
  const [items, setItems] = useState(() =>
    sortInboxConversations(serverConversations)
  )

  const activeIdRef = useRef(activeId)
  const onRefreshRef = useRef(onRefresh)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    setItems(sortInboxConversations(serverConversations))
  }, [serverConversations])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      onRefreshRef.current()
    }, debounceMs)
  }, [debounceMs])

  const applyMessageInsert = useCallback((row: MessageRow) => {
    setItems((prev) => {
      const idx = prev.findIndex((c) => c.id === row.conversation_id)
      if (idx === -1) return prev

      const current = prev[idx]!
      const isActive = activeIdRef.current === row.conversation_id
      const preview = messagePreviewFromInsert(row)
      const unreadCount =
        row.role === "guest"
          ? isActive
            ? 0
            : current.unreadCount + 1
          : current.unreadCount

      const next = prev.slice()
      next[idx] = {
        ...current,
        lastMessageAt: row.created_at,
        lastMessagePreview: preview,
        unreadCount,
      }
      return sortInboxConversations(next)
    })
  }, [])

  const applyConversationChange = useCallback(
    (row: Record<string, unknown>, event: "INSERT" | "UPDATE") => {
      const id = typeof row.id === "string" ? row.id : null
      if (!id) return

      let needsRefresh = false

      setItems((prev) => {
        const idx = prev.findIndex((c) => c.id === id)
        if (idx === -1) {
          if (event === "INSERT") needsRefresh = true
          return prev
        }

        const next = prev.slice()
        next[idx] = patchConversationFromRealtimeRow(prev[idx]!, row)
        return sortInboxConversations(next)
      })

      if (needsRefresh) scheduleRefresh()
    },
    [scheduleRefresh]
  )

  useEffect(() => {
    const supabase = createClient()
    const filter = `organization_id=eq.${organizationId}`
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const onAnyChange = () => scheduleRefresh()

    async function subscribe() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      await supabase.realtime.setAuth(data.session?.access_token)
      if (cancelled) return

      channel = supabase
        .channel(`inbox-list:${organizationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter,
          },
          (payload) => {
            const row = payload.new as MessageRow
            if (row?.conversation_id) applyMessageInsert(row)
            onAnyChange()
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>
            if (row && payload.eventType !== "DELETE") {
              applyConversationChange(
                row,
                payload.eventType === "INSERT" ? "INSERT" : "UPDATE"
              )
            }
            onAnyChange()
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "contacts",
            filter,
          },
          onAnyChange
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      cancelled = true
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [
    organizationId,
    applyMessageInsert,
    applyConversationChange,
    scheduleRefresh,
  ])

  return items
}
