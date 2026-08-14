import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { InvitationWithRole } from "@/types/database"

/**
 * Get all invitations for an organization.
 * Returns both pending and expired/accepted invitations.
 * Cached per request using React.cache().
 */
export const getOrganizationInvitations = cache(
  async (organizationId: string): Promise<InvitationWithRole[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("invitations")
      .select("*, roles(*)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return (data as unknown as InvitationWithRole[]) || []
  }
)

/**
 * Get only pending invitations for an organization.
 * Cached per request using React.cache().
 */
export const getPendingInvitations = cache(
  async (organizationId: string): Promise<InvitationWithRole[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("invitations")
      .select("*, roles(*)")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return (data as unknown as InvitationWithRole[]) || []
  }
)

/**
 * Get a single invitation by token (for the invitation acceptance flow).
 * Does NOT use React.cache() since this is typically called during a one-time acceptance flow.
 */
export const getInvitationByToken = async (token: string): Promise<InvitationWithRole | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invitations")
    .select("*, roles(*), organizations(name, slug, logo_url)")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (error) {
    return null
  }

  return data as unknown as InvitationWithRole
}
