import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getProfileById } from "@/lib/supabase/queries/profiles"
import { AppSidebar } from "@/components/app-sidebar"
import { OrgProvider } from "@/contexts/org-context"
import { UserProvider } from "@/contexts/user-context"
import { PermissionProvider } from "@/lib/permissions/context"
import { getOrgPermissions, getOrgRole } from "@/lib/permissions/server"
import { toOrganizationPayload } from "@/lib/serialization/organizations"
import type { UserPayload } from "@/types/serialization"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function OrgLayout({
  params,
  children,
}: LayoutProps<"/[slug]">) {
  const { slug } = await params
  const headersList = await headers()
  const organizationId = headersList.get("x-organization-id")

  if (!organizationId) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect("/login")
  }

  const org = await getOrganizationBySlug(slug)
  if (!org || org.id !== organizationId) {
    notFound()
  }

  const [profile, permissions, role] = await Promise.all([
    getProfileById(authUser.id),
    getOrgPermissions(organizationId),
    getOrgRole(organizationId),
  ])

  const userPayload: UserPayload = {
    id: authUser.id,
    email: authUser.email ?? "",
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    phone: profile?.phone ?? null,
    job_title: profile?.job_title ?? null,
    department: profile?.department ?? null,
    last_login_at: profile?.last_login_at ?? null,
    created_at: profile?.created_at ?? new Date().toISOString(),
    updated_at: profile?.updated_at ?? new Date().toISOString(),
  }

  return (
    <OrgProvider organization={toOrganizationPayload(org)}>
      <UserProvider user={userPayload}>
        <PermissionProvider permissions={permissions} role={role}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="h-svh overflow-y-auto">{children}</SidebarInset>
          </SidebarProvider>
        </PermissionProvider>
      </UserProvider>
    </OrgProvider>
  )
}
