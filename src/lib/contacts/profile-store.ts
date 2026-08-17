import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/database"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  diffContactProfile,
  type ContactProfileChange,
  type ContactProfileSnapshot,
} from "@/lib/inbox/thread-events"

/**
 * The person behind a turn, and the one way to read or write them.
 *
 * A turn runs against a real `contacts` row on WhatsApp and against a preview
 * persona in the dashboard. Those are different tables with the same shape, so
 * the tools depend on this interface rather than on either table — the caller
 * decides which one a turn is talking to, and nothing downstream has to know.
 */

type DB = SupabaseClient<Database>

/** Everything the assistant may see about a person. */
export interface ContactProfile {
  firstName: string | null
  lastName: string | null
  /** E.164, as stored. */
  phone: string | null
  email: string | null
  nationality: string | null
  country: string | null
  preferredLanguage: string | null
  /** The team's own note. The assistant reads it; only staff write it. */
  notes: string | null
}

/** What the assistant may change: identity only, never phone, never the note. */
export type ContactProfilePatch = Partial<
  Omit<ContactProfile, "phone" | "notes">
>

export interface ContactProfileStore {
  read(): Promise<ContactProfile | null>
  /**
   * Apply a patch and report what actually moved.
   *
   * `null` is a failed write. An empty array is a write that changed nothing —
   * the customer repeating a name we already had, which happens far more often
   * than a real edit and must not become an event. The store computes this
   * rather than the caller, because only the store sees the row on both sides.
   */
  write(patch: ContactProfilePatch): Promise<ContactProfileChange[] | null>
}

/**
 * Where the person behind this turn lives. A discriminated union rather than a
 * pair of nullable ids, so an impossible state (both set, neither set) cannot
 * be written down.
 */
export type ContactRef =
  | { kind: "contact"; contactId: string }
  | { kind: "preview_persona"; sessionId: string }

const PROFILE_COLUMNS =
  "first_name, last_name, phone, email, nationality, country, preferred_language, notes"

/** Row → profile. Shared because both tables carry the same column names. */
function rowToProfile(row: {
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  nationality: string | null
  country: string | null
  preferred_language: string | null
  notes: string | null
}): ContactProfile {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    nationality: row.nationality,
    country: row.country,
    preferredLanguage: row.preferred_language,
    notes: row.notes,
  }
}

/** Profile → the column-keyed shape `diffContactProfile` compares. */
function profileToSnapshot(
  profile: ContactProfile | null
): ContactProfileSnapshot {
  if (!profile) return {}
  return {
    first_name: profile.firstName,
    last_name: profile.lastName,
    email: profile.email,
    nationality: profile.nationality,
    country: profile.country,
    preferred_language: profile.preferredLanguage,
    notes: profile.notes,
  }
}

/**
 * Narrow a snapshot to the columns this write actually touched.
 *
 * The diff runs against the row as it came back rather than against the patch
 * we sent, so a value another writer had already applied is not claimed as ours
 * — but only across the columns we wrote. Left whole, a concurrent edit to some
 * other field would be announced under this writer's name.
 */
function project(
  snapshot: ContactProfileSnapshot,
  keys: readonly string[]
): ContactProfileSnapshot {
  const out: Record<string, unknown> = {}
  for (const key of keys) out[key] = snapshot[key as keyof ContactProfileSnapshot]
  return out as ContactProfileSnapshot
}

/** Patch → column names, with the two-letter codes upper-cased on the way in. */
function patchToColumns(patch: ContactProfilePatch) {
  const columns: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    nationality?: string | null
    country?: string | null
    preferred_language?: string | null
  } = {}
  if (patch.firstName !== undefined) columns.first_name = patch.firstName
  if (patch.lastName !== undefined) columns.last_name = patch.lastName
  if (patch.email !== undefined) columns.email = patch.email
  if (patch.nationality !== undefined) {
    columns.nationality = patch.nationality?.toUpperCase() ?? null
  }
  if (patch.country !== undefined) {
    columns.country = patch.country?.toUpperCase() ?? null
  }
  if (patch.preferredLanguage !== undefined) {
    columns.preferred_language = patch.preferredLanguage
  }
  return columns
}

/**
 * The real contact card, as staff see it in the inbox. Scoped to the org even
 * though the client is service-role — the id alone is never enough.
 */
export function contactsProfileStore(
  supabase: DB,
  args: { contactId: string; orgId: string }
): ContactProfileStore {
  async function read(): Promise<ContactProfile | null> {
    const { data } = await supabase
      .from("contacts")
      .select(PROFILE_COLUMNS)
      .eq("id", args.contactId)
      .eq("organization_id", args.orgId)
      .maybeSingle()
    return data ? rowToProfile(data) : null
  }

  return {
    read,

    async write(patch) {
      const columns = patchToColumns(patch)
      if (Object.keys(columns).length === 0) return []

      const before = await read()

      const { data, error } = await supabase
        .from("contacts")
        .update({
          ...columns,
          // Version signal — lets an already-open inbox panel notice the write
          // and re-sync, even though the contact id itself didn't change.
          updated_at: new Date().toISOString(),
        })
        .eq("id", args.contactId)
        .eq("organization_id", args.orgId)
        // The updated row comes back in the same round trip, so only the
        // "before" costs a second query.
        .select(PROFILE_COLUMNS)
        .maybeSingle()

      if (error || !data) return null

      const written = Object.keys(columns)
      return diffContactProfile(
        project(profileToSnapshot(before), written),
        project(profileToSnapshot(rowToProfile(data)), written)
      )
    },
  }
}

/**
 * The preview session's own copy of a persona.
 *
 * Writes land on the session, never on the persona the staff defined, so a test
 * run can watch the assistant learn a name without dirtying the card. Starting
 * a new conversation starts from the template again.
 */
export function previewPersonaProfileStore(
  supabase: DB,
  args: { sessionId: string; orgId: string }
): ContactProfileStore {
  async function readSnapshot(): Promise<ContactProfile | null> {
    const { data } = await supabase
      .from("assistant_preview_sessions")
      .select("persona_snapshot")
      .eq("id", args.sessionId)
      .eq("organization_id", args.orgId)
      .maybeSingle()

    return parsePersonaSnapshot(data?.persona_snapshot)
  }

  return {
    read: readSnapshot,

    async write(patch) {
      const current = await readSnapshot()
      if (!current) return null

      const merged: ContactProfile = {
        ...current,
        ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
        ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.nationality !== undefined
          ? { nationality: patch.nationality?.toUpperCase() ?? null }
          : {}),
        ...(patch.country !== undefined
          ? { country: patch.country?.toUpperCase() ?? null }
          : {}),
        ...(patch.preferredLanguage !== undefined
          ? { preferredLanguage: patch.preferredLanguage }
          : {}),
      }

      const { error } = await supabase
        .from("assistant_preview_sessions")
        // A flat record of strings and nulls is valid `Json`, but the generated
        // type is structural and an interface carries no index signature.
        .update({ persona_snapshot: merged as unknown as Json })
        .eq("id", args.sessionId)
        .eq("organization_id", args.orgId)

      if (error) return null

      // Nothing reads these — a sandbox thread has no event line — but the
      // interface means one thing on both stores, so the answer is computed the
      // same way rather than faked with an empty array.
      const written = Object.keys(patchToColumns(patch))
      return diffContactProfile(
        project(profileToSnapshot(current), written),
        project(profileToSnapshot(merged), written)
      )
    },
  }
}

/**
 * Read a snapshot back out of jsonb. Old sessions have none, and the column is
 * `Json`, so everything is proved before it is trusted.
 */
export function parsePersonaSnapshot(value: unknown): ContactProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>

  const text = (key: string): string | null =>
    typeof raw[key] === "string" && raw[key] !== "" ? (raw[key] as string) : null

  return {
    firstName: text("firstName"),
    lastName: text("lastName"),
    phone: text("phone"),
    email: text("email"),
    nationality: text("nationality"),
    country: text("country"),
    preferredLanguage: text("preferredLanguage"),
    notes: text("notes"),
  }
}

/**
 * Turn the request context's `contactRef` into a store. Returns null in the one
 * case that has no person at all — a turn that ran before either id was set.
 */
export function resolveContactProfileStore(args: {
  contactRef: ContactRef | null | undefined
  orgId: string | undefined
}): ContactProfileStore | null {
  if (!args.contactRef || !args.orgId) return null

  const supabase = createAdminClient()
  return args.contactRef.kind === "contact"
    ? contactsProfileStore(supabase, {
        contactId: args.contactRef.contactId,
        orgId: args.orgId,
      })
    : previewPersonaProfileStore(supabase, {
        sessionId: args.contactRef.sessionId,
        orgId: args.orgId,
      })
}
