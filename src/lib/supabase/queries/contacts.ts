import { createClient } from "@/lib/supabase/server"

export interface ContactDetail {
  contactId: string | null
  /** Display name, derived from first/last by the DB trigger. */
  name: string | null
  firstName: string | null
  lastName: string | null
  phone: string
  email: string | null
  /** ISO 3166-1 alpha-2, as the contact states it. */
  nationality: string | null
  /** ISO 3166-1 alpha-2, seeded from the phone number. */
  country: string | null
  preferredLanguage: string | null
  tags: string[]
  notes: string | null
  /** First contact (contact.created_at) — "customer since". */
  createdAt: string | null
  lastSeenAt: string | null
  /**
   * Version signal for the contact row (null when there's no linked contact).
   * The inbox panel keys on this so an in-place profile write — by staff or
   * the assistant — is picked up even while the panel stays mounted for the
   * same contact.
   */
  updatedAt: string | null
  /** Aggregates across all of this contact's conversations in the org. */
  totalConversations: number
  totalMessages: number
  /** The conversation currently open in the inbox. */
  conversation: {
    id: string
    status: string
    language: string
    createdAt: string
    messageCount: number
  }
}

/**
 * Load the unified profile + conversation context for the inbox detail panel.
 * RLS scopes every read to the caller's org (inbox.access). Falls back to the
 * conversation's own guest name/phone when no contact row is linked (older rows).
 */
export async function getConversationContactDetail(
  conversationId: string
): Promise<ContactDetail | null> {
  const supabase = await createClient()

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, contact_id, status, language, created_at, guest_name, guest_phone")
    .eq("id", conversationId)
    .maybeSingle()

  if (!conv) return null

  const { count: convMessageCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conv.id)

  const base = {
    conversation: {
      id: conv.id,
      status: conv.status,
      language: conv.language,
      createdAt: conv.created_at,
      messageCount: convMessageCount ?? 0,
    },
  }

  if (!conv.contact_id) {
    return {
      contactId: null,
      name: conv.guest_name,
      firstName: null,
      lastName: null,
      phone: conv.guest_phone,
      email: null,
      nationality: null,
      country: null,
      preferredLanguage: null,
      tags: [],
      notes: null,
      createdAt: null,
      lastSeenAt: null,
      updatedAt: null,
      totalConversations: 1,
      totalMessages: convMessageCount ?? 0,
      ...base,
    }
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select(
      "id, name, first_name, last_name, phone, email, nationality, country, preferred_language, tags, notes, created_at, last_seen_at, updated_at"
    )
    .eq("id", conv.contact_id)
    .maybeSingle()

  // All conversations for this contact → drives both aggregates.
  const { data: contactConvs } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", conv.contact_id)

  const conversationIds = (contactConvs ?? []).map((c) => c.id)
  let totalMessages = 0
  if (conversationIds.length > 0) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
    totalMessages = count ?? 0
  }

  return {
    contactId: contact?.id ?? conv.contact_id,
    name: contact?.name ?? conv.guest_name,
    phone: contact?.phone ?? conv.guest_phone,
    firstName: contact?.first_name ?? null,
    lastName: contact?.last_name ?? null,
    email: contact?.email ?? null,
    nationality: contact?.nationality ?? null,
    country: contact?.country ?? null,
    preferredLanguage: contact?.preferred_language ?? null,
    tags: contact?.tags ?? [],
    notes: contact?.notes ?? null,
    createdAt: contact?.created_at ?? null,
    lastSeenAt: contact?.last_seen_at ?? null,
    updatedAt: contact?.updated_at ?? null,
    totalConversations: conversationIds.length || 1,
    totalMessages,
    ...base,
  }
}
