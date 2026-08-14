import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export const ROW_ICON_TILE_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-xl border border-input bg-input/50"

/** Shared icon tile for knowledge table rows and detail sidebar rows. */
export function SidebarRowIcon({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon
  children?: ReactNode
}) {
  return (
    <div className={ROW_ICON_TILE_CLASS}>
      {Icon ? (
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
      ) : (
        children
      )}
    </div>
  )
}
