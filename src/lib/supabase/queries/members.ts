import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { MemberPayload } from "@/types/serialization"
import type { OrganizationMemberWithProfile, Role } from "@/types/database"

/**
 * Get all members of an organization via the get_organization_members RPC.
 * The RPC joins organization_members + profiles + auth.users + roles in a
 * single SECURITY DEFINER call so we get e-mails without duplicating data.
 * Cached per request using React.cache().
 */
export const getOrganizationMembers = cache(
  async (organizationId: string): Promise<MemberPayload[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
      "get_organization_members" as never,
      { org_id: organizationId } as never,
    )

    if (error) {
      throw error
    }

    return (data as unknown as MemberPayload[]) ?? []
  }
)

/**
 * Get the current user's membership in an organization (with role).
 * Cached per request using React.cache().
 */
export const getCurrentMembership = cache(
  async (organizationId: string): Promise<OrganizationMemberWithProfile | null> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
      .from("organization_members")
      .select("*, profiles(*), roles(*)")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (error) {
      return null
    }

    return data as unknown as OrganizationMemberWithProfile
  }
)

/**
 * Get all global roles available.
 * Roles are shared across all organizations.
 * Cached per request using React.cache().
 */
export const getRoles = cache(async (): Promise<Role[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .in("name", ["owner", "admin", "member"])
    .order("id")

  if (error) {
    throw error
  }

  return data || []
})
