import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Permission } from "./types"

type AuthSuccess = {
  ok: true
  userId: string
  organizationId: string
  permissions: string[]
}

type AuthFailure = {
  ok: false
  response: NextResponse
}

/**
 * Defense-in-depth for API routes: verify org membership + permission via DB RPC.
 */
export async function requireOrgPermission(
  organizationId: string,
  permission: Permission
): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 }),
    }
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single()

  if (membershipError || !membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bu organizasyona erişim izniniz yok" },
        { status: 403 }
      ),
    }
  }

  const { data: permissions, error: permError } = await supabase.rpc(
    "get_user_permissions_for_org",
    { p_org_id: organizationId }
  )

  if (permError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Yetki kontrolü başarısız" }, { status: 500 }),
    }
  }

  const list = (permissions as string[] | null) ?? []
  const allowed =
    list.includes("*") || list.includes(permission)

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 }),
    }
  }

  return { ok: true, userId: user.id, organizationId, permissions: list }
}
