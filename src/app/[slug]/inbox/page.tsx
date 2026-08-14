import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import {
  listConversations,
  getConversationThread,
} from "@/lib/supabase/queries/inbox"
import { getConversationContactDetail } from "@/lib/supabase/queries/contacts"
import { InboxClient } from "./inbox-client"

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ c?: string }>
}) {
  const { slug } = await params
  const { c } = await searchParams
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  const conversations = await listConversations(org.id)
  // Opening the inbox lands on a conversation rather than on an empty reading
  // pane. The list is ordered pinned-first, then newest, so the top row is what
  // the team came in for. No redirect: `?c=` stays a record of a deliberate
  // choice, and the address bar does not rewrite itself on the way in.
  const requested = c && conversations.some((x) => x.id === c) ? c : null
  const activeId = requested ?? conversations[0]?.id ?? null
  const [thread, contactDetail] = activeId
    ? await Promise.all([
        getConversationThread(activeId),
        getConversationContactDetail(activeId),
      ])
    : [null, null]

  return (
    <InboxClient
      slug={slug}
      organizationId={org.id}
      conversations={conversations}
      activeId={activeId}
      thread={thread}
      contactDetail={contactDetail}
    />
  )
}
