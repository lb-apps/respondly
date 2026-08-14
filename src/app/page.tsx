import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserOrganizations } from "@/lib/supabase/queries/organizations"
import { getOrgPermissions } from "@/lib/permissions/server"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const organizations = await getUserOrganizations()
  const firstOrg = organizations[0]

  if (firstOrg?.slug) {
    const permissions = await getOrgPermissions(firstOrg.id)

    let defaultModule = "settings/account"
    if (permissions.includes("*") || permissions.includes("inbox.access")) {
      defaultModule = "inbox"
    } else if (permissions.includes("channels.access")) {
      defaultModule = "channels"
    } else if (permissions.includes("knowledge.access")) {
      defaultModule = "knowledge"
    } else if (permissions.includes("integrations.access")) {
      defaultModule = "mcp"
    } else if (permissions.includes("assistant.access")) {
      defaultModule = "assistant"
    } else if (
      permissions.includes("settings.members") ||
      permissions.includes("settings.organization")
    ) {
      defaultModule = "settings"
    }

    redirect(`/${firstOrg.slug}/${defaultModule}`)
  }

  redirect("/signup")
}
