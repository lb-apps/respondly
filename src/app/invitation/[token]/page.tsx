import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getInvitationByToken } from "@/lib/supabase/queries/invitations"
import { InvitationPageClient } from "./invitation-page-client"

interface InvitationPageProps {
  params: Promise<{ token: string }>
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    redirect("/login?error=invalid_invitation")
  }

  // Check if invitation is expired
  const isExpired = new Date(invitation.expires_at) < new Date()
  if (isExpired) {
    redirect("/login?error=expired_invitation")
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-6">
      <InvitationPageClient
        token={token}
        invitation={{
          id: invitation.id,
          email: invitation.email,
          organizationName: (invitation as { organizations?: { name: string } }).organizations?.name ?? "",
          organizationSlug: (invitation as { organizations?: { slug: string } }).organizations?.slug ?? "",
          roleName: invitation.roles?.name ?? "",
        }}
        isAuthenticated={!!user}
        authenticatedEmail={user?.email ?? null}
      />
    </div>
  )
}
