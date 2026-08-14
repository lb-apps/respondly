import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { getOrgChannel } from "@/lib/supabase/queries/channels"
import { readProfileCache } from "@/lib/whatsapp/profile/channel-settings"
import { ChannelsClient } from "./channels-client"

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  const channel = await getOrgChannel(org.id)
  const base = process.env.APP_URL ?? ""
  // Meta posts every app event to ONE callback URL (not per-channel).
  const webhookUrl = base ? `${base}/api/whatsapp/webhook` : null
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? ""

  // Our mirror of the Meta profile. Rendering from this rather than calling
  // Graph here keeps the page fast and keeps it working when Meta is down;
  // the form's "Yenile" button is what re-reads from Meta.
  const cache = readProfileCache(channel?.settings ?? null)
  // A hotel org that has never synced gets Meta's closest category pre-selected.
  const vertical =
    cache.syncedAt === null && org.industry === "hotel" ? "HOTEL" : cache.vertical

  return (
    <ChannelsClient
      slug={slug}
      organizationId={org.id}
      webhookUrl={webhookUrl}
      verifyToken={verifyToken}
      initial={{
        id: channel?.id ?? null,
        phoneNumber: channel?.phone_number ?? "",
        phoneNumberId: channel?.wa_phone_number_id ?? "",
        wabaId: channel?.waba_id ?? "",
        appId: channel?.wa_app_id ?? "",
        status: channel?.status ?? "disconnected",
        hasToken: !!channel?.wa_access_token_secret_id,
      }}
      profile={{
        about: cache.about,
        description: cache.description,
        address: cache.address,
        email: cache.email,
        vertical,
        website1: cache.websites[0] ?? "",
        website2: cache.websites[1] ?? "",
      }}
      profileSyncedAt={cache.syncedAt}
      profilePictureStoragePath={cache.pictureStoragePath}
    />
  )
}
