import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 })
  }

  const { data: invitation, error: invError } = await supabase
    .from("invitations")
    .select("*, roles(id, name)")
    .eq("token", token)
    .eq("status", "pending")
    .single()

  if (invError || !invitation) {
    return NextResponse.json({ error: "Geçersiz veya süresi dolmuş davet" }, { status: 404 })
  }

  if (user.email !== invitation.email) {
    return NextResponse.json(
      { error: "Bu davet farklı bir e-posta adresine gönderilmiş" },
      { status: 403 }
    )
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "Bu davetin süresi dolmuş" }, { status: 410 })
  }

  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", invitation.organization_id)
    .eq("user_id", user.id)
    .single()

  if (existingMember) {
    await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id)

    return NextResponse.json({ success: true })
  }

  const { data: newMember, error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: invitation.organization_id,
      user_id: user.id,
      role_id: invitation.role_id,
    })
    .select("id")
    .single()

  if (memberError || !newMember) {
    return NextResponse.json({ error: "Organizasyona katılınamadı" }, { status: 500 })
  }

  const roleName = (invitation.roles as { name: string } | null)?.name

  if (roleName === "member") {
    const { data: invitePerms } = await supabase
      .from("invitation_permissions")
      .select("permission")
      .eq("invitation_id", invitation.id)

    const perms = invitePerms?.map((row) => row.permission) ?? []

    if (perms.length > 0) {
      const { error: ompError } = await supabase.from("organization_member_permissions").insert(
        perms.map((permission) => ({
          organization_member_id: newMember.id,
          permission,
        }))
      )

      if (ompError) {
        await supabase.from("organization_members").delete().eq("id", newMember.id)
        return NextResponse.json({ error: "Üye izinleri kaydedilemedi" }, { status: 500 })
      }
    }
  }

  await supabase
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)

  return NextResponse.json({ success: true })
}
