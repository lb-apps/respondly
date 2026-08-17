import { ArrowLeftRight, ArrowRight, Bot, Headset, UserPen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { formatClockTr } from "@/lib/format/datetime"
import {
  CONTACT_PROFILE_LABELS,
  contactProfileChangeText,
  formatContactProfileValue,
  threadEventText,
  type ThreadEvent,
} from "@/lib/inbox/thread-events"
import type { ThreadSender } from "@/lib/supabase/queries/inbox"

/**
 * What happened to a conversation, drawn across the thread.
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
const EVENT_ICON: Record<ThreadEvent["kind"], typeof Bot> = {
  // Two hands, neither of them ours yet: the assistant has let go and nobody
  // has picked it up.
  handoff_to_human: ArrowLeftRight,
  // Someone is on the line now.
  takeover: Headset,
  returned_to_assistant: Bot,
  contact_profile_updated: UserPen,
}

export function ThreadEventDivider({
  id,
  event,
  sender,
  createdAt,
}: {
  /** Anchors the scroll-to-message from search, the way a bubble does. */
  id: string
  event: ThreadEvent
  /**
   * Who caused it: `null` when the assistant did, the teammate's profile
   * otherwise. `{ name: null }` is a teammate with no name on file, and must
   * not read as the assistant.
   */
  sender: ThreadSender | null
  createdAt: string
}) {
  const Icon = EVENT_ICON[event.kind]

  return (
    // The sentence and what it is about are one beat of the conversation, so
    // they share the day group's spacing rather than sitting apart in it.
    <div id={`msg-${id}`} className="flex w-full flex-col items-center gap-1.5">
      {/* `Marker`'s own `text-muted-foreground` measures 4.44:1 against the
          thread's `bg-sidebar` — under AA, and a hair under the 4.61 recorded
          for it, which was taken against the page background rather than the
          surface this actually sits on. 60% of the foreground reads as quiet as
          muted did and passes in both themes: 5.16 light, 6.68 dark, measured
          composited over `--sidebar` rather than as a flat colour. */}
      <Marker variant="separator" className="text-foreground/60 text-xs">
        <MarkerIcon className="size-3.5">
          <Icon className="size-3.5" />
        </MarkerIcon>
        {/* One sentence, ending in when it happened — a second, fainter element
            would only be a second thing to scan, and dimming it far enough to
            read as secondary took it under 4.5:1.

            A card update carries no clock: it sits directly under the reply it
            came with, which is stamped with the same minute, and the change
            itself is spelled out below. A handoff keeps its time — how long a
            conversation waited for a person is the point of the line. */}
        <MarkerContent>
          {threadEventText(event, sender)}
          {event.kind === "contact_profile_updated"
            ? null
            : ` · ${formatClockTr(createdAt)}`}
        </MarkerContent>
      </Marker>

      {/* `w-full`, not `max-w-full`: inside a centred column the row would
          otherwise shrink to fit while the chips inside it sized themselves off
          that same shrinking width, and the whole thing collapsed to the chips'
          padding. A definite width breaks the loop; `justify-center` still
          centres them. */}
      {event.kind === "contact_profile_updated" ? (
        <ul className="flex w-full flex-wrap justify-center gap-1.5">
          {event.changes.map((change) => (
            <li key={change.field} className="max-w-full">
              {/* `outline` and not a filled chip: in the dark theme `--card` and
                  `--sidebar` are the same colour, so a filled one would vanish
                  into the thread it sits on. A transparent fill with a border
                  reads on both. */}
              <Badge
                variant="outline"
                className="text-foreground/60 max-w-full font-normal"
              >
                {/* What is drawn is fragments around an arrow, with a dash where
                    a value is missing — punctuation a screen reader either
                    skips or mispronounces. It says the same thing in words
                    instead, and hides the drawing. */}
                <span className="sr-only">{contactProfileChangeText(change)}</span>
                <span aria-hidden className="flex min-w-0 items-center gap-1">
                  <span className="text-foreground/80 shrink-0">
                    {CONTACT_PROFILE_LABELS[change.field]}
                  </span>
                  {"to" in change ? (
                    <>
                      <span className="truncate">
                        {formatContactProfileValue(change.field, change.from)}
                      </span>
                      <ArrowRight className="size-3 shrink-0" />
                      <span className="truncate">
                        {formatContactProfileValue(change.field, change.to)}
                      </span>
                    </>
                  ) : null}
                </span>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
