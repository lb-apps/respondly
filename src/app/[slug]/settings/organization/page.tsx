import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Organizasyon Ayarları
        </h1>
        <p className="text-sm text-muted-foreground">
          {org.name} — bu bölüm yakında eklenecek.
        </p>
      </div>
    </div>
  )
}
