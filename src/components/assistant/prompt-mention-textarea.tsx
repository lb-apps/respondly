"use client"

import * as React from "react"
import { InputGroupTextarea } from "@/components/ui/input-group"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { McpServerSummary } from "@/lib/mcp/types"
import {
  applyMention,
  findActiveMention,
  mentionText,
  type ActiveMention,
} from "@/lib/assistant/mention"
import {
  buildMentionableGroups,
  filterMentionableGroups,
  flattenGroups,
} from "@/lib/assistant/mentionable-tools"
import { caretCoordinates } from "./caret-coordinates"

/**
 * The system-prompt editor, with `@` to reference a tool.
 *
 * Writing a good prompt means naming tools exactly — one typo in
 * `mydora_search_availability` and the instruction silently points at nothing.
 * So the names come from the same catalogue the model is given, and are picked
 * rather than typed.
 *
 * Focus never leaves the textarea. The list is driven from the textarea's own
 * key handling and cmdk is used as a controlled highlight, which is why it runs
 * with `shouldFilter={false}` and an explicit `value`: the author is still
 * typing a document, not operating a menu.
 */

/** Ids the textarea points at. Derived, so they are known before render. */
const LISTBOX_ID = "prompt-mention-list"
const optionId = (toolName: string) => `prompt-mention-${toolName}`

interface PromptMentionTextareaProps extends Omit<
  React.ComponentProps<"textarea">,
  "value" | "onChange"
> {
  value: string
  onChange: (value: string) => void
  /** Connected servers, already discovered. Built-in tools are added here. */
  servers: McpServerSummary[]
}

export function PromptMentionTextarea({
  value,
  onChange,
  servers,
  onKeyDown,
  onBlur,
  className,
  ref,
  ...props
}: PromptMentionTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // The component needs the node to measure the caret, and the form library
  // wants it to focus the field on a validation error. Both get it.
  const attachRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )
  const [mention, setMention] = React.useState<ActiveMention | null>(null)
  const [anchor, setAnchor] = React.useState({ top: 0, left: 0, height: 0 })
  const [active, setActive] = React.useState("")
  /**
   * Which `@` the author dismissed with Escape. Without this the very next
   * keystroke — even the keyup of Escape itself — re-detects the same mention
   * and the list springs back, which makes Escape look broken.
   */
  const dismissed = React.useRef<number | null>(null)
  /** Which `@` the open list belongs to, so a new one resets the highlight. */
  const openedAt = React.useRef<number | null>(null)

  const groups = React.useMemo(() => buildMentionableGroups(servers), [servers])
  const visible = React.useMemo(
    () => (mention ? filterMentionableGroups(groups, mention.query) : []),
    [groups, mention],
  )
  const flat = React.useMemo(() => flattenGroups(visible), [visible])
  const open = mention !== null && flat.length > 0

  // Derived, not stored: whatever the filter leaves, the highlight has to be
  // one of them. Recomputing beats an effect that chases the list.
  const highlighted = flat.some((tool) => tool.name === active)
    ? active
    : (flat[0]?.name ?? "")

  /**
   * A combobox announces its list and its highlighted option by id, so both
   * ids have to be known at render time. cmdk generates its own and discards
   * any passed as props, which would leave `aria-activedescendant` pointing at
   * nothing — the list would be invisible to a screen reader even though it is
   * on screen.
   *
   * Stamping the id from a ref callback fixes that without an Effect and
   * without state: refs run after React has applied props, so ours is the id
   * that survives, and it is derived from the value rather than generated.
   */
  const stampListId = React.useCallback((node: HTMLElement | null) => {
    if (node) node.id = LISTBOX_ID
  }, [])

  const stampOptionId = React.useCallback((node: HTMLElement | null) => {
    if (node) node.id = optionId(node.getAttribute("data-value") ?? "")
  }, [])

  /** Re-read the caret and decide whether a mention is open. */
  const syncMention = React.useCallback((element: HTMLTextAreaElement) => {
    const caret = element.selectionStart ?? 0
    const found =
      element.selectionStart === element.selectionEnd
        ? findActiveMention(element.value, caret)
        : null

    if (!found || found.start !== dismissed.current) dismissed.current = null
    if (found && found.start === dismissed.current) {
      setMention(null)
      return
    }

    // A different `@` is a different question — start its list at the top
    // rather than on whatever was highlighted last time.
    if (found && openedAt.current !== found.start) setActive("")
    openedAt.current = found?.start ?? null

    setMention(found)
    if (found) setAnchor(caretCoordinates(element, caret))
  }, [])

  const insert = React.useCallback(
    (toolName: string) => {
      const element = textareaRef.current
      if (!element || !mention) return

      const next = applyMention(value, mention, mentionText(toolName))
      onChange(next.value)
      setMention(null)

      // The value lands on the next render; move the caret once it is there.
      requestAnimationFrame(() => {
        element.focus()
        element.setSelectionRange(next.caret, next.caret)
      })
    },
    [mention, onChange, value],
  )

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      const index = flat.findIndex((tool) => tool.name === highlighted)

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const step = event.key === "ArrowDown" ? 1 : -1
        const next = (index + step + flat.length) % flat.length
        setActive(flat[next].name)
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        insert(highlighted)
        return
      }
      if (event.key === "Escape") {
        // Dismiss the list without disturbing the text or the caret.
        event.preventDefault()
        dismissed.current = mention.start
        setMention(null)
        return
      }
    }

    onKeyDown?.(event)
  }

  return (
    <Popover open={open}>
      <div className="relative w-full">
        <InputGroupTextarea
          ref={attachRef}
          value={value}
          className={className}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? LISTBOX_ID : undefined}
          aria-activedescendant={open ? optionId(highlighted) : undefined}
          onChange={(event) => {
            onChange(event.target.value)
            syncMention(event.currentTarget)
          }}
          onKeyUp={(event) => syncMention(event.currentTarget)}
          onClick={(event) => syncMention(event.currentTarget)}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            setMention(null)
            onBlur?.(event)
          }}
          {...props}
        />

        {/* Zero-size anchor parked at the caret, so the list opens beside the
            word being typed rather than at the edge of a very tall box. */}
        <PopoverAnchor
          className="pointer-events-none absolute"
          style={{ top: anchor.top, left: anchor.left, height: anchor.height }}
        />
      </div>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
        // Focus stays in the textarea; the list is a view onto it.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Picking with the mouse must not blur the textarea first — a blur
        // closes the list, and the click would land on nothing.
        onMouseDown={(event) => event.preventDefault()}
      >
        <Command
          shouldFilter={false}
          value={highlighted}
          onValueChange={setActive}
        >
          <CommandList ref={stampListId}>
            {visible.map((group) => (
              <CommandGroup key={group.id} heading={group.label}>
                {group.tools.map((tool) => (
                  <CommandItem
                    key={tool.name}
                    ref={stampOptionId}
                    value={tool.name}
                    onSelect={insert}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="font-mono text-sm">{tool.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {tool.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
