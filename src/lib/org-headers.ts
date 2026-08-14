import { headers } from "next/headers"
import { redirect } from "next/navigation"

/**
 * Read the organization ID injected by middleware into the request headers.
 * Redirects to home if the header is missing (middleware was bypassed).
 */
export async function getOrganizationIdFromHeaders(): Promise<string> {
  const headersList = await headers()
  const organizationId = headersList.get("x-organization-id")

  if (!organizationId) {
    redirect("/")
  }

  return organizationId
}

/**
 * Read the organization slug injected by middleware into the request headers.
 * Returns null if not present (e.g., outside org-scoped routes).
 */
export async function getOrgSlugFromHeaders(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get("x-organization-slug")
}
