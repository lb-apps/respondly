/**
 * Classification for the assistant claim audit.
 *
 * Pure and standalone so it can be unit tested — `run-turn` is `server-only`.
 */
const PRICE_KEYS = /^(price|total|amount|currency|rate|fee|cost|subtotal|tutar|fiyat)/i
const AVAILABILITY_KEYS =
  /^(available|availability|vacan|slot|inventory|stock|rooms|nights|müsait|stok)/i

/** Field names of an object payload, a few levels deep. */
function collectKeys(value: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 4 || value == null || out.length > 200) return out
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, depth + 1, out)
    return out
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out.push(key)
      collectKeys(child, depth + 1, out)
    }
  }
  return out
}

/**
 * Classify a claim for the audit log.
 *
 * Matches on field *names*, not on the serialized blob: a page of prose about a
 * neighbourhood mentions "price" in passing and would otherwise be filed as a
 * price claim, which is exactly what happened before. Prose carries no fields,
 * so it is informational by definition.
 */
export function inferClaimKind(
  value: unknown
): "price" | "availability" | "policy" {
  if (typeof value === "string" || typeof value === "number") return "policy"

  const keys = collectKeys(value)
  if (keys.some((key) => PRICE_KEYS.test(key))) return "price"
  if (keys.some((key) => AVAILABILITY_KEYS.test(key))) return "availability"
  return "policy"
}
