"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { formatDateTimeTr } from "@/lib/format/datetime"
import { LinkAutoToggles } from "./link-auto-toggles"
import { updateLinkSourceSettings } from "./actions"

export function LinkSourceSettings({
  sourceId,
  slug,
  autoRefresh: initialRefresh,
  autoRemove: initialRemove,
  lastRefreshedAt,
  onUpdated,
}: {
  sourceId: string
  slug: string
  autoRefresh: boolean
  autoRemove: boolean
  lastRefreshedAt: string | null
  onUpdated: () => void
}) {
  const [autoRefresh, setAutoRefresh] = useState(initialRefresh)
  const [autoRemove, setAutoRemove] = useState(initialRemove)
  const [pending, startTransition] = useTransition()
  const committed = useRef({
    refresh: initialRefresh,
    remove: initialRemove,
  })
  const draft = useRef({
    refresh: initialRefresh,
    remove: initialRemove,
  })

  useEffect(() => {
    committed.current = {
      refresh: initialRefresh,
      remove: initialRemove,
    }
    draft.current = { ...committed.current }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoRefresh(initialRefresh)
    setAutoRemove(initialRemove)
  }, [sourceId, initialRefresh, initialRemove])

  function persist() {
    const { refresh, remove } = draft.current
    startTransition(async () => {
      const res = await updateLinkSourceSettings({
        sourceId,
        slug,
        autoRefresh: refresh,
        autoRemove: remove,
      })
      if (!res.ok) {
        draft.current = { ...committed.current }
        setAutoRefresh(committed.current.refresh)
        setAutoRemove(committed.current.remove)
        toast.error("Ayarlar kaydedilemedi", { description: res.error })
        return
      }
      committed.current = { refresh, remove }
      onUpdated()
    })
  }

  return (
    <>
      <LinkAutoToggles
        idPrefix={`detail-${sourceId}`}
        className="contents"
        autoRefresh={autoRefresh}
        setAutoRefresh={(v) => {
          draft.current.refresh = v
          setAutoRefresh(v)
          persist()
        }}
        autoRemove={autoRemove}
        setAutoRemove={(v) => {
          draft.current.remove = v
          setAutoRemove(v)
          persist()
        }}
        disabled={pending}
      />
      {autoRefresh && lastRefreshedAt && (
        <p className="text-xs text-muted-foreground">
          Son tarama: {formatDateTimeTr(lastRefreshedAt)}
        </p>
      )}
    </>
  )
}
