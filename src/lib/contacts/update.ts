import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import { recordContactProfileEvent } from "@/lib/inbox/record-thread-event"
import {
  CONTACT_PROFILE_COLUMNS,
  diffContactProfile,
} from "@/lib/inbox/thread-events"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"
import type { Database, TablesUpdate } from "@/types/database"

/**
 * Writing a contact card, from wherever a teammate edits one.
 *
 * Two surfaces do it — the inbox detail panel and the Kişiler page — and both
 * owe the thread the same line when something actually moves. The rule that
 * makes that line honest ("diff the row, not the patch") lives here once: the
 * panel always submits every field, so a patch says nothing about what changed,
 * and a second copy of this logic would drift into announcing edits nobody made.
 *
 * The caller passes its own Supabase client, so RLS (`inbox.access`) decides
 * what may be written — this module never reaches for a service-role client.
 */

type DB = SupabaseClient<Database>

export const contactPatchSchema = z.object({
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  nationality: z.string().trim().length(2).nullable().optional(),
  country: z.string().trim().length(2).nullable().optional(),
  preferredLanguage: z.enum(GUEST_LOCALES).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})

export type ContactPatch = z.infer<typeof contactPatchSchema>

/**
 * Patch → columns. `name` is missing on purpose: a DB trigger derives it from
 * first/last, and writing it here would let the two disagree.
 */
export function contactPatchToColumns(
  patch: ContactPatch
): TablesUpdate<"contacts"> {
  const update: TablesUpdate<"contacts"> = {}
  if (patch.firstName !== undefined) update.first_name = patch.firstName || null
  if (patch.lastName !== undefined) update.last_name = patch.lastName || null
  if (patch.email !== undefined) update.email = patch.email || null
  if (patch.nationality !== undefined) {
    update.nationality = patch.nationality?.toUpperCase() || null
  }
  if (patch.country !== undefined) {
    update.country = patch.country?.toUpperCase() || null
  }
  if (patch.preferredLanguage !== undefined) {
    update.preferred_language = patch.preferredLanguage || null
  }
  if (patch.tags !== undefined) update.tags = patch.tags
  if (patch.notes !== undefined) update.notes = patch.notes || null
  return update
}

/** How this teammate is named in the sentence stored on the event row. */
export async function actorDisplayName(
  supabase: DB,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle()

  if (!data) return null
  return [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || null
}

/**
 * The thread this change is announced in.
 *
 * The inbox knows it — the panel is open on one conversation. The Kişiler page
 * does not, and a contact may have several, so the newest one carries the line.
 * A contact with no conversation at all (added by hand, never written to us)
 * has nowhere to put it, and that is not an error.
 */
async function latestConversationId(
  supabase: DB,
  contactId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}

export type ApplyContactPatchResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Apply a patch to one contact and announce whatever actually moved.
 *
 * `conversationId` names the thread the line goes in; omit it and the contact's
 * newest conversation is used instead.
 */
export async function applyContactPatch(
  supabase: DB,
  args: {
    contactId: string
    patch: ContactPatch
    actorUserId: string
    /** The thread to announce in. Resolved from the contact when omitted. */
    conversationId?: string | null
  }
): Promise<ApplyContactPatchResult> {
  const update = contactPatchToColumns(args.patch)
  if (Object.keys(update).length === 0) return { ok: true }

  // Version signal — lets an already-open panel (this teammate's or another
  // tab's) detect the write and re-sync, even though the id itself didn't move.
  update.updated_at = new Date().toISOString()

  const { data: before } = await supabase
    .from("contacts")
    .select(CONTACT_PROFILE_COLUMNS)
    .eq("id", args.contactId)
    .maybeSingle()

  const { data: after, error } = await supabase
    .from("contacts")
    .update(update)
    // The updated row and the org it belongs to come back together, which is
    // also where the event below gets its `orgId` — no extra round trip.
    .select(`organization_id, ${CONTACT_PROFILE_COLUMNS}`)
    .eq("id", args.contactId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!after) return { ok: false, error: "Kişi bulunamadı" }

  const changes = diffContactProfile(before ?? {}, after)
  if (changes.length > 0) {
    const conversationId =
      args.conversationId ??
      (await latestConversationId(supabase, args.contactId))

    if (conversationId) {
      await recordContactProfileEvent(supabase, {
        orgId: after.organization_id,
        target: { kind: "conversation", conversationId },
        changes,
        actorUserId: args.actorUserId,
        actorName: await actorDisplayName(supabase, args.actorUserId),
      })
    }
  }

  return { ok: true }
}
