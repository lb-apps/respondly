import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Server-only Supabase client using the service-role key.
 * Bypasses Row Level Security — use ONLY in Server Components for public data access.
 * Never expose this client or the service-role key to the browser.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
