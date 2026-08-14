import { createClient } from "@/lib/supabase/server"
import type { Conversation, Message } from "@/types/database"
import { parseMetadataAttachments } from "@/lib/assistant/attachments/parts"
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/assistant/attachments/constants"
import { parseHandoffEvent, type HandoffEvent } from "@/lib/inbox/handoff-events"

/**
 * One page of a thread. WhatsApp-sized rather than "everything": a page is what
 * fills a screen and a bit, and older ones arrive as the reader scrolls up.
 * Rendering 200 messages up front cost a large RSC payload, a signed storage
 * URL per image in it, and a DOM nobody had asked to see.
 */
export const THREAD_PAGE_SIZE = 30

export interface ConversationListItem {
  id: string
  guestName: string | null
  guestPhone: string
  status: string
  language: string
  lastMessageAt: string
  lastMessagePreview: string | null
  unreadCount: number
  pinnedAt: string | null
  channelKind: string | null
  /**
   * Set while an assistant turn is running, cleared when it finishes — the
   * same lock `try_claim_conversation_turn` takes. It is what the thread's
   * "yazıyor…" line reads; nothing else in the app has to guess.
   */
  turnLockedAt: string | null
}

type ConversationRow = Conversation & {
  unread_count: number
  pinned_at: string | null
  channels: { kind: string; provider: string } | null
  contacts: { name: string | null } | null
}

/**
 * What to call the person in this thread.
 *
 * The contact card wins. `conversations.guest_name` is the WhatsApp push name,
 * written once when the thread was created and never touched again — so a name
 * staff corrected on the card, or one the assistant learned mid-conversation,
 * would show everywhere except the two places they actually look. The card's
 * `name` is kept in step with its first and last name by a database trigger.
 */
function displayName(row: ConversationRow): string | null {
  return row.contacts?.name?.trim() || row.guest_name
}

/**
 * List the org's conversations, pinned first then most-recently-active. RLS
 * scopes this to the caller's orgs (inbox.access).
 */
export async function listConversations(
  organizationId: string
): Promise<ConversationListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, guest_name, guest_phone, status, language, last_message_at, last_message_preview, unread_count, pinned_at, turn_locked_at, channels(kind, provider), contacts(name)"
    )
    .eq("organization_id", organizationId)
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("last_message_at", { ascending: false })
    .limit(100)

  if (error || !data) return []

  return (data as ConversationRow[]).map((c) => ({
    id: c.id,
    guestName: displayName(c),
    guestPhone: c.guest_phone,
    status: c.status,
    language: c.language,
    lastMessageAt: c.last_message_at,
    lastMessagePreview: c.last_message_preview,
    unreadCount: c.unread_count ?? 0,
    pinnedAt: c.pinned_at,
    channelKind: c.channels?.kind ?? null,
    turnLockedAt: c.turn_locked_at,
  }))
}

export interface ThreadAttachment {
  kind: string
  filename: string
  mimeType: string
  signedUrl: string | null
}

export interface ThreadMessage {
  id: string
  role: string
  body: string
  type: string
  createdAt: string
  richContent: unknown[] | null
  /** Which tools the assistant turn called; see `@/lib/assistant/tool-trace`. */
  toolTrace: unknown[] | null
  /**
   * Set on `system` rows only: the moment the conversation changed hands. See
   * `@/lib/inbox/handoff-events`.
   */
  event: HandoffEvent | null
  attachments: ThreadAttachment[]
  /**
   * Who on the team sent this, for staff messages. Null for everything else —
   * the assistant and the guest are not teammates, and a reply written before
   * this was recorded has no sender either.
   */
  sender: ThreadSender | null
}

export interface ThreadSender {
  name: string | null
  avatarUrl: string | null
}

export interface ConversationThread {
  conversation: ConversationListItem
  messages: ThreadMessage[]
  /** Where the next (older) page starts. Null when the thread starts here. */
  nextCursor: ThreadCursor | null
  hasMore: boolean
}

/**
 * Keyset cursor, not an offset. New messages arrive while someone reads, and
 * an offset would shift under them — page 2 would repeat or skip rows. The
 * pair is `(created_at, id)` because two messages can share a millisecond.
 */
export interface ThreadCursor {
  createdAt: string
  id: string
}

export interface ThreadMessagePage {
  messages: ThreadMessage[]
  nextCursor: ThreadCursor | null
  hasMore: boolean
}

type MessageRow = Message & {
  rich_content: unknown
  tool_trace: unknown
  metadata: unknown
}

type DB = Awaited<ReturnType<typeof createClient>>

/**
 * `messages.sender_user_id` references `auth.users`, not `profiles`, so
 * PostgREST cannot embed the profile. One round trip for the whole page rather
 * than one per message.
 */
async function loadSenders(
  supabase: DB,
  rows: MessageRow[]
): Promise<Map<string, ThreadSender>> {
  const ids = [...new Set(rows.map((m) => m.sender_user_id).filter((id) => id != null))]
  const senders = new Map<string, ThreadSender>()
  if (ids.length === 0) return senders

  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", ids)

  for (const p of data ?? []) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim()
    senders.set(p.id, { name: name || null, avatarUrl: p.avatar_url })
  }
  return senders
}

async function toThreadMessage(
  supabase: DB,
  m: MessageRow,
  senders: Map<string, ThreadSender>
): Promise<ThreadMessage> {
  // Signing is a network call each. Serially, a page of photos spent its whole
  // budget waiting; the URLs do not depend on one another.
  const attachments = await Promise.all(
    parseMetadataAttachments(m.metadata).map(async (att) => {
      let signedUrl: string | null = null
      if (att.kind === "image") {
        const { data: signed } = await supabase.storage
          .from(CHAT_ATTACHMENTS_BUCKET)
          .createSignedUrl(att.storage_path, 3600)
        signedUrl = signed?.signedUrl ?? null
      }
      return {
        kind: att.kind,
        filename: att.filename,
        mimeType: att.mime_type,
        signedUrl,
      }
    })
  )

  return {
    id: m.id,
    role: m.role,
    body: m.body,
    type: m.type,
    createdAt: m.created_at,
    richContent: Array.isArray(m.rich_content) ? m.rich_content : null,
    toolTrace: Array.isArray(m.tool_trace) ? m.tool_trace : null,
    event: parseHandoffEvent(m.metadata),
    attachments,
    sender: m.sender_user_id ? (senders.get(m.sender_user_id) ?? null) : null,
  }
}

/**
 * One page of a thread: read newest-first so a `limit` takes the *latest*
 * messages, returned oldest-first because that is the order they are read in.
 * `before` walks backwards through the history, a page at a time.
 */
async function loadThreadMessagePage(
  supabase: DB,
  conversationId: string,
  before: ThreadCursor | null
): Promise<ThreadMessagePage> {
  let query = supabase
    .from("messages")
    .select(
      "id, role, body, type, rich_content, tool_trace, metadata, created_at, sender_user_id"
    )
    .eq("conversation_id", conversationId)

  if (before) {
    // Strictly older than the cursor, ties broken by id — the same ordering the
    // query applies below, written as a filter.
    query = query.or(
      `created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt."${before.id}")`
    )
  }

  const { data } = await query
    .order("created_at", { ascending: false })
    // Two messages can share a millisecond (a reply and its photos); without a
    // tie-break they would swap places between renders and across pages.
    .order("id", { ascending: false })
    // One row past the page answers "is there more?" without a second query.
    .limit(THREAD_PAGE_SIZE + 1)

  const rows = (data as MessageRow[]) ?? []
  const hasMore = rows.length > THREAD_PAGE_SIZE
  const rowsInPage = hasMore ? rows.slice(0, THREAD_PAGE_SIZE) : rows
  const oldest = rowsInPage[rowsInPage.length - 1]

  const ordered = [...rowsInPage].reverse()
  const senders = await loadSenders(supabase, ordered)
  const messages = await Promise.all(
    ordered.map((m) => toThreadMessage(supabase, m, senders))
  )

  return {
    messages,
    nextCursor:
      hasMore && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
    hasMore,
  }
}

/**
 * The page of messages immediately older than `before`. Feeds the thread's
 * scroll-up pagination; the conversation row itself is already on screen.
 */
export async function getOlderThreadMessages(
  conversationId: string,
  before: ThreadCursor
): Promise<ThreadMessagePage> {
  const supabase = await createClient()
  return loadThreadMessagePage(supabase, conversationId, before)
}

/**
 * Load one conversation plus its most recent page of messages (chronological).
 * RLS guarantees the caller can only read conversations in their own orgs.
 * Returns null when the id doesn't resolve under the caller's access.
 */
export async function getConversationThread(
  conversationId: string
): Promise<ConversationThread | null> {
  const supabase = await createClient()

  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, guest_name, guest_phone, status, language, last_message_at, last_message_preview, unread_count, pinned_at, turn_locked_at, channels(kind, provider), contacts(name)"
    )
    .eq("id", conversationId)
    .maybeSingle()

  if (!conv) return null

  const page = await loadThreadMessagePage(supabase, conversationId, null)

  const c = conv as ConversationRow
  return {
    conversation: {
      id: c.id,
      guestName: displayName(c),
      guestPhone: c.guest_phone,
      status: c.status,
      language: c.language,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: c.last_message_preview,
      unreadCount: c.unread_count ?? 0,
      pinnedAt: c.pinned_at,
      channelKind: c.channels?.kind ?? null,
      turnLockedAt: c.turn_locked_at,
    },
    messages: page.messages,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}
