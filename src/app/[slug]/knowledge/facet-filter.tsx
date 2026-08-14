"use client"

import { Plus, X, type LucideIcon } from "lucide-react"
import type { Icon } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type FacetOption = { value: string; label: string; icon?: Icon }

/**
 * Linear-style faceted filter. Inactive: a dashed "+ Label" add button.
 * Active: a removable chip (clear X + label + selected count) whose value
 * segment reopens the multi-select popover. Shared by Knowledge + Medya.
 */
export function FacetFilter({
  label,
  icon: Icon,
  unitLabel,
  options,
  selected,
  onChange,
}: {
  label: string
  icon: LucideIcon | Icon
  unitLabel: string
  options: FacetOption[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const count = selected.size
  const active = count > 0

  function toggle(value: string, on: boolean) {
    const next = new Set(selected)
    if (on) next.add(value)
    else next.delete(value)
    onChange(next)
  }

  const optionList = (
    <DropdownMenuContent align="start" className="w-52">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {options.length === 0 ? (
        <DropdownMenuItem disabled>Seçenek yok</DropdownMenuItem>
      ) : (
        options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.has(o.value)}
            onCheckedChange={(on) => toggle(o.value, Boolean(on))}
            onSelect={(e) => e.preventDefault()}
          >
            {o.icon && <o.icon className="size-4 text-muted-foreground" />}
            {o.label}
          </DropdownMenuCheckboxItem>
        ))
      )}
    </DropdownMenuContent>
  )

  if (!active) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-dashed text-muted-foreground"
          >
            <Plus className="size-3.5" />
            {label}
          </Button>
        </DropdownMenuTrigger>
        {optionList}
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <div className="inline-flex h-8 items-center overflow-hidden rounded-2xl border border-input bg-input/50 text-sm">
        <button
          type="button"
          onClick={() => onChange(new Set())}
          aria-label={`${label} filtresini temizle`}
          className="flex h-full items-center px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-full items-center gap-1.5 border-l pr-2 pl-2.5 transition-colors hover:bg-muted"
          >
            <Icon className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{label}</span>
            <Badge variant="secondary" className="px-1.5 tabular-nums">
              {count} {unitLabel}
            </Badge>
          </button>
        </DropdownMenuTrigger>
      </div>
      {optionList}
    </DropdownMenu>
  )
}
