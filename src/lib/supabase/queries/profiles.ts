import { cache } from "react"
import { LRUCache } from "lru-cache"
import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/types/database"

const PROFILE_TTL_MS = 5 * 60 * 1000 // 5 minutes

const profileCache = new LRUCache<string, Profile>({ max: 200, ttl: PROFILE_TTL_MS })

/**
 * Invalidate the module-level LRU cache for a specific profile.
 * Call this whenever profile data is updated.
 */
export function invalidateProfileCache(userId: string) {
  profileCache.delete(userId)
}

/**
 * Get profile by user ID.
 * Module-level LRU cache (5 min TTL) + per-request React.cache deduplication.
 */
export const getProfileById = cache(async (userId: string): Promise<Profile | null> => {
  const cached = profileCache.get(userId)
  if (cached) return cached

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  if (error) {
    return null
  }

  const profile = data as Profile
  profileCache.set(userId, profile)

  return profile
})
