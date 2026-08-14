"use client"

import { RefreshCw, Trash2, type LucideIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { SidebarRowIcon } from "./sidebar-row-icon"

/** Vertical spacing between sidebar rows in the detail panel. */
export const DETAIL_SIDEBAR_STACK_CLASS = "flex flex-col gap-6"

/** Stacked link toggles (e.g. add-url dialog). */
export const LINK_AUTO_TOGGLES_CLASS = "flex flex-col gap-4"

function LinkToggleRow({
  id,
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <SidebarRowIcon icon={icon} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <Label htmlFor={id} className="font-normal leading-snug">
            {title}
          </Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}

export function LinkAutoToggles({
  autoRefresh,
  setAutoRefresh,
  autoRemove,
  setAutoRemove,
  idPrefix,
  disabled,
  className,
}: {
  autoRefresh: boolean
  setAutoRefresh: (v: boolean) => void
  autoRemove: boolean
  setAutoRemove: (v: boolean) => void
  idPrefix: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(LINK_AUTO_TOGGLES_CLASS, className)}
    >
      <LinkToggleRow
        id={`${idPrefix}-refresh`}
        icon={RefreshCw}
        title="Otomatik yenileme"
        description="7 günde bir yeniden tara"
        checked={autoRefresh}
        onCheckedChange={setAutoRefresh}
        disabled={disabled}
      />
      <LinkToggleRow
        id={`${idPrefix}-remove`}
        icon={Trash2}
        title="Otomatik kaldırma"
        description="URL kalkarsa kaynağı sil"
        checked={autoRemove}
        onCheckedChange={setAutoRemove}
        disabled={disabled}
      />
    </div>
  )
}
