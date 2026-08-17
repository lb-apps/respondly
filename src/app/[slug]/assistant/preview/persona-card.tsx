"use client"

import { memo } from "react"
import { Pencil } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContactAvatar } from "@/components/inbox/contact-avatar"
import { cn } from "@/lib/utils"
import type { PreviewPersona } from "@/lib/supabase/queries/preview-personas"
import { personaDisplayName, personaLanguageLabel } from "./persona-identity"

/**
 * One mock contact card in the picker.
 *
 * A real `<button>`, not a styled div: the whole card is the target, so it has
 * to be reachable and pressable from the keyboard. Memoized because the picker
 * re-renders on every selection and a card only changes when it is edited.
 */
export const PersonaCard = memo(function PersonaCard({
  persona,
  selected,
  onSelect,
  onEdit,
}: {
  persona: PreviewPersona
  selected: boolean
  onSelect: (personaId: string) => void
  onEdit: (persona: PreviewPersona) => void
}) {
  const name = personaDisplayName(persona)
  const language = personaLanguageLabel(persona)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(persona.id)}
        aria-pressed={selected}
        // Named explicitly: read from its contents the button would announce
        // the label, the name, every tag and the whole note in one breath.
        aria-label={`${persona.label} olarak konuş`}
        className={cn(
          "bg-card flex h-full w-full flex-col gap-3 rounded-xl border p-4 text-left transition-colors duration-150",
          "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:outline-none",
          selected ? "border-primary ring-primary/40 ring-1" : "hover:bg-accent"
        )}
      >
        <div className="flex items-start gap-3">
          <ContactAvatar size="lg" seed={persona.phone} />
          {/* Room for the edit button, which floats over this corner. */}
          <div className="min-w-0 flex-1 pr-7">
            <p className="truncate text-sm font-medium">{persona.label}</p>
            <p className="text-muted-foreground truncate text-xs">{name}</p>
          </div>
        </div>

        {(language || persona.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {language && (
              <Badge variant="secondary" className="font-normal">
                {language}
              </Badge>
            )}
            {persona.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {persona.notes && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {persona.notes}
          </p>
        )}
      </button>

      {/* Outside the card button — a button inside a button is invalid HTML and
          unreachable by keyboard. */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="text-muted-foreground absolute top-2 right-2 size-8"
        onClick={() => onEdit(persona)}
        aria-label={`${persona.label} kartını düzenle`}
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  )
})
