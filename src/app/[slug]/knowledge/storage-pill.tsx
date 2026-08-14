import { Progress } from "@/components/ui/progress"
import { formatBytes } from "@/lib/knowledge/quota"

/**
 * Storage pill: used / quota with primary → chart → destructive ratio coloring.
 */
export function StoragePill({
  used,
  quota,
  label = "RAG depolama",
}: {
  used: number
  quota: number
  label?: string
}) {
  const ratio = quota > 0 ? Math.min(used / quota, 1) : 0
  const pct = Math.round(ratio * 100)
  const tone =
    ratio >= 0.9
      ? "bg-destructive"
      : ratio >= 0.7
        ? "bg-chart-5"
        : "bg-primary"
  return (
    <div className="flex w-44 flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <Progress value={pct} indicatorClassName={tone} className="h-1.5" />
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatBytes(used)} / {formatBytes(quota)}
      </span>
    </div>
  )
}
