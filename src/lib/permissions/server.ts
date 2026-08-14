import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { jwtDecode } from "jwt-decode"

interface JWTPayload {
  user_role?: string
  user_permissions?: string[]
}

/** Org-scoped permissions from DB (preferred). */
export const getOrgPermissions = cache(
  async (organizationId: string): Promise<string[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("get_user_permissions_for_org", {
      p_org_id: organizationId,
    })

    if (error) {
      console.error("[permissions] get_user_permissions_for_org:", error.message)
      return []
    }

    return (data as string[] | null) ?? []
  }
)

export const getOrgRole = cache(
  async (organizationId: string): Promise<string> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return "member"

    const { data } = await supabase
      .from("organization_members")
      .select("roles(name)")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    const role = data?.roles as { name: string } | null
    return role?.name ?? "member"
  }
)

/** @deprecated Use getOrgPermissions(organizationId) for correct org scope. */
export const getSessionPermissions = cache(async (): Promise<string[]> => {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return []

  try {
    const decoded = jwtDecode<JWTPayload>(session.access_token)
    return decoded.user_permissions ?? []
  } catch {
    return []
  }
})

/** @deprecated Use getOrgRole(organizationId). */
export const getSessionRole = cache(async (): Promise<string> => {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return "member"

  try {
    const decoded = jwtDecode<JWTPayload>(session.access_token)
    return decoded.user_role ?? "member"
  } catch {
    return "member"
  }
})
