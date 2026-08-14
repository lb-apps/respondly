import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Channel } from "@/types/database"

/**
 * Get the organization's WhatsApp channel (MVP: one channel per org). Returns
 * null if not connected yet. RLS scopes the query to the caller's orgs and the
 * Vault-held auth token is never selected here (secrets stay server-only).
 */
export const getOrgChannel = cache(
  async (organizationId: string): Promise<Channel | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("kind", "whatsapp")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) return null
    return data as Channel | null
  }
)
