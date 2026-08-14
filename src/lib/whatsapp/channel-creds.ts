import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { MetaCreds } from "./cloud-api/client"

/**
 * Load the Meta credentials for a channel: the sender id from the row, the
 * access token from Vault.
 *
 * The pair is read in four places today, each with its own copy of the same two
 * queries. New code goes through here; migrating the existing three call sites
 * (`turn-runner.ts`, `inbox/actions.ts`, the webhook route) is a separate,
 * mechanical change — those sit on the message delivery path.
 *
 * Takes the client rather than creating one: the caller decides whether the
 * read is RLS-scoped or service-role, and that decision is a security one.
 */

export interface ChannelMetaCreds extends MetaCreds {
  channelId: string
  /** Meta app that owns the token — needed for the Resumable Upload API only. */
  appId: string | null
}

export async function loadChannelMetaCreds(
  db: SupabaseClient<Database>,
  channelId: string
): Promise<ChannelMetaCreds | null> {
  const { data: channel } = await db
    .from("channels")
    .select("wa_phone_number_id, wa_app_id")
    .eq("id", channelId)
    .maybeSingle()

  if (!channel?.wa_phone_number_id) return null

  const { data: accessToken } = await db.rpc("get_channel_wa_token", {
    p_channel_id: channelId,
  })

  if (!accessToken) return null

  return {
    channelId,
    phoneNumberId: channel.wa_phone_number_id,
    accessToken,
    appId: channel.wa_app_id,
  }
}
