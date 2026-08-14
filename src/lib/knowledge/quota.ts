import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Organization } from "@/types/database"

type DB = SupabaseClient<Database>

/**
 * Storage-quota policy for the knowledge base. Single responsibility: decide
 * how many bytes an org may store and whether an incoming add fits. Wired to a
 * config default now (org.settings.knowledge.quotaBytes overrides); real plan
 * tiers slot in later by changing getOrgQuota only.
 */

/**
 * Default per-org knowledge allowance: 5 MB of *extracted text* (≈1M chars).
 *
 * The meter is the indexed text, not the raw upload — that's what drives the
 * cost (embedding tokens) and retrieval quality, and it's what we actually
 * store in `size_bytes` after ingest. (For reference, ElevenLabs' non-enterprise
 * ceiling is 20 MB / 300k chars; 5 MB text is generous for a single business KB
 * while staying cost-aware.) Real plan tiers slot in by changing getOrgQuota.
 */
export const DEFAULT_KNOWLEDGE_QUOTA_BYTES = 5 * 1024 * 1024

/**
 * Default per-org media allowance: 500 MB of raw image bytes. Media is metered
 * by the uploaded file size (not embedded text) — that's the real storage cost.
 * Override per org via settings.media.quotaBytes.
 */
export const DEFAULT_MEDIA_QUOTA_BYTES = 500 * 1024 * 1024

/** Thrown when an add/refresh would push an org over its byte quota. */
export class QuotaExceededError extends Error {
  constructor(
    message: string,
    readonly used: number,
    readonly incoming: number,
    readonly quota: number
  ) {
    super(message)
    this.name = "QuotaExceededError"
  }
}

/** Resolve an org's knowledge (text) quota: settings.knowledge.quotaBytes || default. */
export function getOrgQuota(org: Pick<Organization, "settings">): number {
  const settings = (org.settings ?? {}) as {
    knowledge?: { quotaBytes?: unknown }
  }
  const raw = settings.knowledge?.quotaBytes
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_KNOWLEDGE_QUOTA_BYTES
}

/** Resolve an org's media quota: settings.media.quotaBytes || default. */
export function getOrgMediaQuota(org: Pick<Organization, "settings">): number {
  const settings = (org.settings ?? {}) as {
    media?: { quotaBytes?: unknown }
  }
  const raw = settings.media?.quotaBytes
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MEDIA_QUOTA_BYTES
}

/** Sum of size_bytes across an org's *reference* (text) knowledge sources. */
export async function getUsedBytes(supabase: DB, orgId: string): Promise<number> {
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("size_bytes")
    .eq("organization_id", orgId)
    .eq("category", "reference")
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((sum, r) => sum + (r.size_bytes ?? 0), 0)
}

/** Sum of size_bytes across an org's *media* sources (raw image bytes). */
export async function getMediaUsedBytes(
  supabase: DB,
  orgId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("size_bytes")
    .eq("organization_id", orgId)
    .eq("category", "media")
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((sum, r) => sum + (r.size_bytes ?? 0), 0)
}

/** Humanize bytes for UI copy (e.g. "19.3 kB", "1.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["kB", "MB", "GB", "TB"]
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

/**
 * Throw QuotaExceededError (Turkish message) if used + incoming exceeds quota.
 * Re-ingest of an existing source nets zero — pass its prior size as part of a
 * caller-adjusted `used` so it isn't double-counted.
 */
export function assertWithinQuota(
  used: number,
  incoming: number,
  quota: number
): void {
  if (used + incoming > quota) {
    throw new QuotaExceededError(
      `Depolama kotası aşıldı. Kullanılan ${formatBytes(used)} / ${formatBytes(
        quota
      )}; bu ekleme ${formatBytes(incoming)} daha gerektiriyor.`,
      used,
      incoming,
      quota
    )
  }
}
