import { useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"

interface UseRealtimeSyncOptions {
  channelName: string
  tables: string[]
  /** Supabase Realtime filter, e.g. "organization_id=eq.abc-123" */
  filter?: string
  onSync: () => void | Promise<void>
  debounceMs?: number
  enabled?: boolean
}

export function useRealtimeSync({
  channelName,
  tables,
  filter,
  onSync,
  debounceMs = 400,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const onSyncRef = useRef(onSync)
  useEffect(() => {
    onSyncRef.current = onSync
  }, [onSync])

  const tablesKey = useMemo(() => tables.join(","), [tables])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const tableList = tablesKey.split(",")

    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const fire = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        onSyncRef.current()
      }, debounceMs)
    }

    // Authenticate the Realtime socket with the signed-in user's JWT *before*
    // subscribing. Postgres Changes are RLS-gated: the server evaluates our
    // SELECT policy as whoever the socket claims to be. Subscribe first and the
    // channel joins as `anon` (auth.uid() null → policy false), so no rows are
    // ever delivered — silently. setAuth() before subscribe closes that race.
    async function subscribe() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      await supabase.realtime.setAuth(data.session?.access_token)
      if (cancelled) return

      let ch = supabase.channel(channelName)
      for (const table of tableList) {
        const opts: { event: "*"; schema: "public"; table: string; filter?: string } = {
          event: "*",
          schema: "public",
          table,
        }
        if (filter) {
          opts.filter = filter
        }
        ch = ch.on("postgres_changes", opts, fire)
      }
      ch.subscribe()
      channel = ch
    }

    void subscribe()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [channelName, tablesKey, filter, debounceMs, enabled])
}
