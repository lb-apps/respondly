import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Assistant } from "@/types/database"

/**
 * Get the organization's assistant (MVP: one assistant per org, channel_id
 * filled once WhatsApp is connected). Returns null if none exists yet.
 * RLS scopes the query to the caller's orgs.
 */
export const getOrgAssistant = cache(
  async (organizationId: string): Promise<Assistant | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("assistants")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) return null
    return data as Assistant | null
  }
)
