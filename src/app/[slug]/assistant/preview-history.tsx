"use client"

import { History, MessageSquarePlus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import type { PreviewSessionListItem } from "@/lib/supabase/queries/preview"


function sessionLabel(title: string | null | undefined, fallback: string): string {
  const t = title?.trim()
  return t && t.length > 0 ? t : fallback
}

export function PreviewHistory({
  activeSessionId,
  viewingSessionId,
  sessions,
  sessionsLoading,
  onSelectSession,
}: {
  activeSessionId: string | null
  viewingSessionId: string | null
  sessions: PreviewSessionListItem[]
  sessionsLoading: boolean
  onSelectSession: (sessionId: string) => void
}) {
  const pastSessions = sessions.filter((s) => s.id !== activeSessionId)

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex w-[340px] shrink-0 flex-col border-r lg:w-[360px]">
      <div className="flex items-center gap-2 px-4 py-4">
        <History className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">Geçmiş</span>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-2">
          {sessionsLoading ? (
            <div className="space-y-1 px-1 pt-2">
              <Skeleton className="h-[68px] w-full rounded-xl" />
              <Skeleton className="h-[68px] w-full rounded-xl" />
            </div>
          ) : pastSessions.length > 0 ? (
            <>
              <ul className="flex flex-col gap-0.5">
                {pastSessions.map((session) => {
                  const active = viewingSessionId === session.id
                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors",
                          active
                            ? "bg-sidebar-active text-sidebar-active-foreground"
                            : "hover:bg-sidebar-accent/80"
                        )}
                      >
                        <span
                          className={cn(
                            "line-clamp-2 text-sm leading-snug",
                            active ? "font-semibold" : "font-medium"
                          )}
                        >
                          {sessionLabel(session.title, "Konuşma")}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            !activeSessionId && (
              <Empty className="border-0 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageSquarePlus className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">Henüz kayıt yok</EmptyTitle>
                  <EmptyDescription className="text-xs leading-relaxed">
                    İlk mesajını gönderdiğinde oturumlar burada listelenir.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
