import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { ActivityLog, ActivityLogAction, ActivityLogEntityType, Profile } from "@/types/database"

export interface ActivityLogFilters {
  action?: ActivityLogAction
  entityType?: ActivityLogEntityType
  search?: string
}

export interface PaginatedActivityLogs {
  logs: ActivityLog[]
  totalCount: number
}

const DEFAULT_PAGE_SIZE = 50

/**
 * Get all data needed for the activity page in parallel (org-scoped).
 * Returns only the first page of logs + total count + user profiles.
 */
export const getActivityPageData = cache(async (organizationId: string) => {
  const supabase = await createClient()

  const [logsResult, profilesResult, currentUserResult] = await Promise.all([
    supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(0, DEFAULT_PAGE_SIZE - 1),
    supabase.from("profiles").select("id, first_name, last_name, avatar_url"),
    supabase.auth.getUser(),
  ])

  if (logsResult.error) throw logsResult.error
  if (profilesResult.error) throw profilesResult.error

  const logs = (logsResult.data as ActivityLog[]) || []
  const totalCount = logsResult.count ?? 0

  const profileMap: Record<string, Profile> = {}
  if (profilesResult.data) {
    for (const profile of profilesResult.data) {
      profileMap[profile.id] = profile as Profile
    }
  }

  return {
    logs,
    totalCount,
    userProfiles: profileMap,
    currentUserId: currentUserResult.data.user?.id || null,
  }
})
