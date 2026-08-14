import { cache } from "react"
import { LRUCache } from "lru-cache"
import { createClient } from "@/lib/supabase/server"
import type { Organization } from "@/types/database"

const ORG_TTL_MS = 5 * 60 * 1000 // 5 minutes

const orgCacheById = new LRUCache<string, Organization>({ max: 50, ttl: ORG_TTL_MS })
const orgCacheBySlug = new LRUCache<string, Organization>({ max: 50, ttl: ORG_TTL_MS })

/**
 * Invalidate the module-level LRU cache for a specific organization.
 * Call this whenever organization settings are updated.
 */
export function invalidateOrgCache(orgId: string, slug: string) {
  orgCacheById.delete(orgId)
  orgCacheBySlug.delete(slug)
}

/**
 * Get organization by slug.
 * Module-level LRU cache (5 min TTL) + per-request React.cache deduplication.
 */
export const getOrganizationBySlug = cache(async (slug: string): Promise<Organization | null> => {
  const cached = orgCacheBySlug.get(slug)
  if (cached) return cached

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .single()

  if (error) {
    return null
  }

  const org = data as Organization
  orgCacheBySlug.set(slug, org)
  orgCacheById.set(org.id, org)

  return org
})

/**
 * Get organization by ID.
 * Module-level LRU cache (5 min TTL) + per-request React.cache deduplication.
 */
export const getOrganizationById = cache(async (organizationId: string): Promise<Organization | null> => {
  const cached = orgCacheById.get(organizationId)
  if (cached) return cached

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single()

  if (error) {
    return null
  }

  const org = data as Organization
  orgCacheById.set(organizationId, org)
  orgCacheBySlug.set(org.slug, org)

  return org
})

/**
 * Get all organizations the current user belongs to.
 * Cached per request using React.cache().
 */
export const getUserOrganizations = cache(async (): Promise<Organization[]> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("organization_members")
    .select("organizations(*)")
    .eq("user_id", user.id)

  if (error) {
    throw error
  }

  return (data || [])
    .map((row) => row.organizations)
    .filter((org): org is Organization => !!org)
})
