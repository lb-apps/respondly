import * as React from "react"
import { after, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"
import { InvitationEmail } from "@emails/invitation-email"
import { requireOrgPermission } from "@/lib/permissions/require"
import {
  MEMBER_MODULE_PERMISSIONS,
  type MemberModulePermission,
} from "@/lib/permissions/types"

interface InviteRequestBody {
  email: string
  roleId: string
  organizationId: string
  firstName?: string
  lastName?: string
  modulePermissions?: MemberModulePermission[]
}

const VALID_MEMBER_PERMISSIONS = new Set<MemberModulePermission>(
  MEMBER_MODULE_PERMISSIONS
)

export async function POST(request: Request) {
  let body: InviteRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 })
  }

  const { email, roleId, organizationId, firstName, lastName, modulePermissions } = body

  if (!email || !roleId || !organizationId) {
    return NextResponse.json(
      { error: "E-posta, rol ve organizasyon alanları zorunludur" },
      { status: 400 }
    )
  }

  const auth = await requireOrgPermission(organizationId, "settings.members")
  if (!auth.ok) {
    return auth.response
  }

  const supabase = await createClient()

  const { data: targetRole, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .single()

  if (roleError || !targetRole) {
    return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 })
  }

  if (!["owner", "admin", "member"].includes(targetRole.name)) {
    return NextResponse.json({ error: "Bu rol ile davet gönderilemez" }, { status: 400 })
  }

  const normalizedModulePerms =
    targetRole.name === "member"
      ? (modulePermissions ?? []).filter((p): p is MemberModulePermission =>
          VALID_MEMBER_PERMISSIONS.has(p as MemberModulePermission)
        )
      : []

  if (targetRole.name === "member" && normalizedModulePerms.length === 0) {
    return NextResponse.json(
      { error: "Üye rolü için en az bir modül erişimi seçilmelidir" },
      { status: 400 }
    )
  }

  const [membershipResult, profileResult] = await Promise.all([
    supabase
      .from("organization_members")
      .select("organizations(name, slug, logo_url)")
      .eq("organization_id", organizationId)
      .eq("user_id", auth.userId)
      .single(),
    supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", auth.userId)
      .single(),
  ])

  if (membershipResult.error || !membershipResult.data) {
    return NextResponse.json(
      { error: "Bu organizasyona erişim izniniz yok" },
      { status: 403 }
    )
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data: invitation, error: insertError } = await supabase
    .from("invitations")
    .insert({
      organization_id: organizationId,
      invited_by: auth.userId,
      email: email.trim().toLowerCase(),
      first_name: firstName?.trim() ? firstName.trim() : null,
      last_name: lastName?.trim() ? lastName.trim() : null,
      role_id: roleId,
      token,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select("*, roles(*)")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Bu e-posta adresine zaten bekleyen bir davet var" },
        { status: 409 }
      )
    }
    console.error("[invitations] DB insert error:", insertError)
    return NextResponse.json({ error: "Davet oluşturulamadı" }, { status: 500 })
  }

  if (normalizedModulePerms.length > 0) {
    const { error: permError } = await supabase.from("invitation_permissions").insert(
      normalizedModulePerms.map((permission) => ({
        invitation_id: invitation.id,
        permission,
      }))
    )

    if (permError) {
      console.error("[invitations] permission insert error:", permError)
      await supabase.from("invitations").delete().eq("id", invitation.id)
      return NextResponse.json({ error: "Davet izinleri kaydedilemedi" }, { status: 500 })
    }
  }

  const {
    data: { user: inviterUser },
  } = await supabase.auth.getUser()

  after(async () => {
    const org = membershipResult.data.organizations as {
      name: string
      slug: string
      logo_url: string | null
    } | null
    const inviter = profileResult.data

    if (!org || !inviter) {
      console.error("[invitations] Missing org or inviter profile")
      return
    }

    const inviterName =
      [inviter.first_name, inviter.last_name].filter(Boolean).join(" ") || undefined

    const roleName =
      (invitation.roles as { name: string } | null)?.name ?? "üye"

    await sendEmail({
      to: email.trim().toLowerCase(),
      subject: `${org.name} organizasyonuna davet edildiniz`,
      react: React.createElement(InvitationEmail, {
        organizationName: org.name,
        orgLogoUrl: org.logo_url ?? undefined,
        inviterName,
        inviterEmail: inviterUser?.email ?? undefined,
        inviterAvatarUrl: inviter.avatar_url ?? undefined,
        inviteLink: `${process.env.APP_URL}/invitation/${token}`,
        role: roleName,
        expiresInDays: 7,
      }),
    })
  })

  return NextResponse.json({ invitation }, { status: 201 })
}
