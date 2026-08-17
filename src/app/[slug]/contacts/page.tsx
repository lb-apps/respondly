import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { listContacts } from "@/lib/supabase/queries/contacts"
import { ContactsClient } from "./contacts-client"

/**
 * Everyone this organization has talked to.
 *
 * The first page is rendered on the server — including a search arriving in the
 * URL, so a shared or reloaded `?q=` shows its results immediately rather than
 * flashing the full list first.
 */
export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { slug } = await params
  const { q } = await searchParams
  await headers()

  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  const search = q?.trim() ?? ""
  const page = await listContacts(org.id, { search })

  return (
    <ContactsClient
      slug={slug}
      organizationId={org.id}
      initialContacts={page.rows}
      initialTotal={page.total}
      initialSearch={search}
    />
  )
}
