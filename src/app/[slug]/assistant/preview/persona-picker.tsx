"use client"

import { Plus } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { PreviewPersona } from "@/lib/supabase/queries/preview-personas"
import { PersonaCard } from "./persona-card"

/**
 * The empty state: pick who you are before you start talking.
 *
 * Replaces the old "send a message to begin" placeholder, because a preview
 * that runs against nobody answers differently from production. One card is
 * always selected, so the composer below is never dead.
 */
export function PersonaPicker({
  personas,
  selectedPersonaId,
  onSelect,
  onEdit,
  onCreate,
}: {
  personas: PreviewPersona[]
  selectedPersonaId: string | null
  onSelect: (personaId: string) => void
  onEdit: (persona: PreviewPersona) => void
  onCreate: () => void
}) {
  return (
    <ScrollArea className="bg-sidebar min-h-0 flex-1">
      {/* A container, not the viewport: this pane sits between the app sidebar
          and the history rail, so a wide window still leaves it narrow. Sized
          off the viewport the cards collapsed to three cramped columns. */}
      <div className="@container mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Kiminle konuşuyorsun?
          </h2>
          <p className="text-muted-foreground text-sm">
            Asistanı gerçek bir kişi kartıyla test et. Seçtiğin kişiyi tanıyormuş
            gibi davranır.
          </p>
        </div>

        <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
          {personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              selected={persona.id === selectedPersonaId}
              onSelect={onSelect}
              onEdit={onEdit}
            />
          ))}

          <button
            type="button"
            onClick={onCreate}
            className="text-muted-foreground hover:text-foreground hover:border-ring focus-visible:ring-ring/50 focus-visible:border-ring flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm transition-colors duration-150 focus-visible:ring-[3px] focus-visible:outline-none"
          >
            <Plus className="size-5" />
            Yeni kişi
          </button>
        </div>
      </div>
    </ScrollArea>
  )
}
