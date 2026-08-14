import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { CHAT_ATTACHMENTS_BUCKET } from "./constants"

type DB = SupabaseClient<Database>

const DEFAULT_TTL_SEC = 3600

export async function signAttachmentUrl(
  supabase: DB,
  storagePath: string,
  ttlSec = DEFAULT_TTL_SEC
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, ttlSec)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function signAttachmentUrls(
  supabase: DB,
  paths: string[],
  ttlSec = DEFAULT_TTL_SEC
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  await Promise.all(
    paths.map(async (path) => {
      const url = await signAttachmentUrl(supabase, path, ttlSec)
      if (url) out.set(path, url)
    })
  )
  return out
}
