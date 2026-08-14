import { ArrowLeftRight, Bot, Headset } from "lucide-react"

import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { formatClockTr } from "@/lib/format/datetime"
import {
  handoffEventText,
  type HandoffEventKind,
} from "@/lib/inbox/handoff-events"

/**
 * Where a conversation changed hands, drawn across the thread.
 *
 * The same shape as the day divider on purpose: both answer "what happened
 * between these two messages", and a second visual language for the same job
 * would only make the thread noisier. It is quieter than the day divider,
 * though — it does not stick to the top, because unlike the date, an event
 * belongs to one point in the conversation and stops being true after it.
 *
 * The icon repeats what the sentence already says (WCAG SC 1.4.1): nothing here
 * is carried by colour or glyph alone, which is also why there is no red for
 * "needs a person" — the words say so.
 */
const EVENT_ICON: Record<HandoffEventKind, typeof Bot> = {
  // Two hands, neither of them ours yet: the assistant has let go and nobody
  // has picked it up.
  handoff_to_human: ArrowLeftRight,
  // Someone is on the line now.
  takeover: Headset,
  returned_to_assistant: Bot,
}

export function ThreadEventDivider({
  kind,
  actorName,
  createdAt,
}: {
  kind: HandoffEventKind
  /** The teammate who caused it, when a person did. */
  actorName?: string | null
  createdAt: string
}) {
  const Icon = EVENT_ICON[kind]
  const time = formatClockTr(createdAt)

  return (
    <Marker variant="separator" className="text-xs">
      <MarkerIcon className="size-3.5">
        <Icon className="size-3.5" />
      </MarkerIcon>
      {/* One sentence, ending in when it happened — a second, fainter element
          would only be a second thing to scan, and dimming it far enough to
          read as secondary took it under 4.5:1. */}
      <MarkerContent>
        {handoffEventText(kind, actorName)} · {time}
      </MarkerContent>
    </Marker>
  )
}
