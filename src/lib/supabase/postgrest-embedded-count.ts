/**
 * PostgREST returns one-to-many embeds as arrays. Nested `relation(count)` is
 * typically `[{ count: number }]`, not `{ count: number }`.
 */
export function getPostgrestEmbeddedCount(relation: unknown): number {
  if (relation == null) return 0

  if (Array.isArray(relation)) {
    const first = relation[0] as { count?: number | string } | undefined
    const value = first?.count
    return typeof value === "number" ? value : Number(value) || 0
  }

  if (typeof relation === "object" && relation !== null && "count" in relation) {
    const value = (relation as { count?: number | string }).count
    return typeof value === "number" ? value : Number(value) || 0
  }

  return 0
}
