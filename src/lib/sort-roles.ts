import type { RolePayload } from "@/types/serialization"

const ROLE_POWER_ORDER: Record<string, number> = {
  member: 0,
  admin: 1,
  owner: 2,
}

/** Sort roles for consistent UI order (member → admin → owner). */
export function sortRolesByPower(roles: RolePayload[]): RolePayload[] {
  return [...roles].sort(
    (a, b) => (ROLE_POWER_ORDER[a.name] ?? 99) - (ROLE_POWER_ORDER[b.name] ?? 99)
  )
}
