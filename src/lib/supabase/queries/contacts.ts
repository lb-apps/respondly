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

/** One person as the Kişiler page draws them. */
export interface ContactCard {
  id: string
  /** Display name, derived from first/last by the DB trigger. Null until known. */
  name: string | null
  firstName: string | null
  lastName: string | null
  /** E.164, as stored. Never rendered raw — `formatPhoneDisplay` owns display. */
  phone: string
  email: string | null
  nationality: string | null
  country: string | null
  preferredLanguage: string | null
  tags: string[]
  notes: string | null
  createdAt: string
  lastSeenAt: string
  /** Version signal, so an edited card re-renders without a full reload. */
  updatedAt: string
  conversationCount: number
  /** Newest conversation, for "Konuşmaya git". Null when they have none yet. */
  lastConversationId: string | null
}

export interface ContactPage {
  rows: ContactCard[]
  /** Matches for the current search across the whole org, not just this page. */
  total: number
}

/** How many cards one request brings back. */
export const CONTACTS_PAGE_SIZE = 48

const CONTACT_CARD_COLUMNS =
  "id, name, first_name, last_name, phone, email, nationality, country, preferred_language, tags, notes, created_at, last_seen_at, updated_at"

/**
 * Make a typed search term safe to drop into a PostgREST `or` filter.
 *
 * The filter is a comma-separated string of `column.op.value` triples, so a
 * comma, a parenthesis or a quote in the term would be read as syntax rather
 * than as text. `*` is PostgREST's own wildcard and `%`/`_` are the pattern
 * characters underneath it — left in, a search for "%" would match everyone.
 */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()*"'\\%_]/g, " ").trim()
}

/** Below this, a digit run is more likely a house number than a phone number. */
const MIN_PHONE_DIGITS = 3

/**
 * The digits of a typed number, as they appear inside a stored E.164 one.
 *
 * People write a number the way their phone shows it — "0536 286 29 98",
 * "(536) 286 29 98" — and it is stored as "+905362862998". Stripping to digits
 * makes the separators irrelevant; dropping the leading zero removes the
 * national trunk prefix, which the stored form does not have. What is left is a
 * substring of the stored number, so a partially typed one still matches.
 *
 * Returns "" for anything that is not really a number, so a name search does
 * not also drag in whoever has those digits in their phone.
 */
function phoneSearchDigits(term: string): string {
  const digits = term.replace(/\D/g, "").replace(/^0+/, "")
  return digits.length >= MIN_PHONE_DIGITS ? digits : ""
}

/**
 * The org's people, newest-seen first, one page at a time.
 *
 * RLS (`inbox.access`) already scopes every read to the caller's orgs; the
 * explicit org filter is what makes *which* org deliberate rather than implied.
 *
 * Search runs over the fields a person is looked up by — their name, the number
 * they write from, their email. A number is searched both as typed and as
 * E.164, so "0532 111 22 33" finds a contact stored as "+905321112233".
 */
export async function listContacts(
  organizationId: string,
  options: { search?: string; limit?: number; offset?: number } = {}
): Promise<ContactPage> {
  const limit = options.limit ?? CONTACTS_PAGE_SIZE
  const offset = options.offset ?? 0
  const term = sanitizeSearchTerm(options.search ?? "")

  const supabase = await createClient()

  let query = supabase
    .from("contacts")
    .select(CONTACT_CARD_COLUMNS, { count: "exact" })
    .eq("organization_id", organizationId)

  if (term) {
    const patterns = [
      `name.ilike.%${term}%`,
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
    ]

    // A number typed the way people write it down still has to reach the E.164
    // row it is stored as.
    const digits = phoneSearchDigits(term)
    if (digits) patterns.push(`phone.ilike.%${digits}%`)

    query = query.or(patterns.join(","))
  }

  const { data, count } = await query
    .order("last_seen_at", { ascending: false })
    .range(offset, offset + limit - 1)

  const rows = data ?? []
  const stats = await conversationStats(rows.map((row) => row.id))

  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email,
      nationality: row.nationality,
      country: row.country,
      preferredLanguage: row.preferred_language,
      tags: row.tags ?? [],
      notes: row.notes,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      updatedAt: row.updated_at,
      conversationCount: stats.get(row.id)?.count ?? 0,
      lastConversationId: stats.get(row.id)?.lastConversationId ?? null,
    })),
    total: count ?? rows.length,
  }
}

/**
 * How many conversations each of these contacts has, and which one is newest.
 *
 * One query for the whole page rather than one per card: the rows are grouped
 * here because Postgrest has no group-by, and a page of 48 cards is 48 round
 * trips otherwise.
 */
async function conversationStats(
  contactIds: string[]
): Promise<Map<string, { count: number; lastConversationId: string }>> {
  const stats = new Map<string, { count: number; lastConversationId: string }>()
  if (contactIds.length === 0) return stats

  const supabase = await createClient()
  const { data } = await supabase
    .from("conversations")
    .select("id, contact_id, last_message_at")
    .in("contact_id", contactIds)
    // Newest first, so the first row seen for a contact is the one to link to.
    .order("last_message_at", { ascending: false })

  for (const row of data ?? []) {
    if (!row.contact_id) continue
    const seen = stats.get(row.contact_id)
    if (seen) seen.count += 1
    else stats.set(row.contact_id, { count: 1, lastConversationId: row.id })
  }

  return stats
}

/** One card, fresh from the database — what an editor sheet reopens onto. */
export async function getContactCard(
  organizationId: string,
  contactId: string
): Promise<ContactCard | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("contacts")
    .select(CONTACT_CARD_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (!data) return null

  const stats = await conversationStats([data.id])
  return {
    id: data.id,
    name: data.name,
    firstName: data.first_name,
    lastName: data.last_name,
    phone: data.phone,
    email: data.email,
    nationality: data.nationality,
    country: data.country,
    preferredLanguage: data.preferred_language,
    tags: data.tags ?? [],
    notes: data.notes,
    createdAt: data.created_at,
    lastSeenAt: data.last_seen_at,
    updatedAt: data.updated_at,
    conversationCount: stats.get(data.id)?.count ?? 0,
    lastConversationId: stats.get(data.id)?.lastConversationId ?? null,
  }
}
