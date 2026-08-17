import { PREFERRED_LANGUAGE_LABELS } from "@/lib/contacts/identity"
import type { GuestLocale } from "@/lib/i18n/guest-locale"

/**
 * A change to someone's contact card, as the thread shows it.
 *
 * The card used to move in silence: the assistant would catch a name out of a
 * sentence and write it, or a teammate would save the panel, and the thread
 * kept no trace of either. Nobody could answer "where did this name come from,
 * who typed it, when" — and a wrong value the assistant wrote was found only by
 * accident.
 *
 * ## Why three call sites and not one trigger
 *
 * An `AFTER UPDATE` trigger on `contacts` would be unforgettable, and it would
 * see OLD and NEW in one transaction. It was rejected anyway, because it cannot
 * know the two things this event is *about*:
 *
 * - **Which conversation.** A contact has many; `contacts` carries no
 *   conversation. "The most recent one" puts the line in the wrong thread
 *   exactly when a returning customer's card is edited from an older one.
 * - **Who did it.** Under the service-role client `auth.uid()` is null for the
 *   assistant and for the webhook alike, so the two become indistinguishable
 *   and a specific teammate is unrecoverable.
 *
 * Passing them in does not rescue it: supabase-js speaks PostgREST, one
 * statement per request, so a transaction-local GUC needs an RPC per writer —
 * at which point all three call sites are instrumented anyway, only in SQL,
 * with the Turkish sentences and this label map dragged along.
 *
 * And the trigger's one real advantage — catching every writer automatically —
 * is a liability here, because it would also catch the inbound seeding, which
 * we deliberately stay out of. **We announce edits, not seeding.**
 */

/**
 * The card fields worth announcing.
 *
 * `name` is absent on purpose: a DB trigger derives it from first and last, so
 * including it would report every rename twice. `phone` is absent because it
 * identifies the conversation rather than describing the person.
 *
 * The order is the order chips appear in, so a row reads the same way twice.
 */
export const CONTACT_PROFILE_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "nationality",
  "country",
  "preferred_language",
  "tags",
  "notes",
] as const

export type ContactProfileField = (typeof CONTACT_PROFILE_FIELDS)[number]

/**
 * One field's move.
 *
 * `from`/`to` are `null` when the field was empty and **absent** when the
 * values are deliberately not carried — which is the whole story for `notes`.
 * Absent and null mean different things and the parser keeps them apart.
 */
export interface ContactProfileChange {
  field: ContactProfileField
  from?: string | null
  to?: string | null
}

export interface ContactProfileUpdatedEvent {
  kind: "contact_profile_updated"
  /** Never empty — a change-less event is not an event. */
  changes: ContactProfileChange[]
}

/**
 * What a writer hands the differ: the card's columns, as they are named in the
 * database. A key that is absent means "I did not touch this field", which is
 * not the same as writing null into it.
 */
export interface ContactProfileSnapshot {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  nationality?: string | null
  country?: string | null
  preferred_language?: string | null
  tags?: string[] | null
  notes?: string | null
}

/**
 * How much of a value is carried into the event.
 *
 * Long enough for a name, an email or a short tag list to survive whole; short
 * enough that eight of them cannot turn one metadata blob into a page. A value
 * that is cut keeps a trailing ellipsis rather than a separate flag — the mark
 * belongs to the value, and every reader of the value then gets it for free,
 * including the sentence a screen reader hears.
 */
export const MAX_EVENT_VALUE_CHARS = 60

export const CONTACT_PROFILE_LABELS: Record<ContactProfileField, string> = {
  first_name: "Ad",
  last_name: "Soyad",
  email: "E-posta",
  nationality: "Uyruk",
  country: "Ülke",
  preferred_language: "Tercih edilen dil",
  tags: "Etiketler",
  notes: "Not",
}

/** Fields whose value is never carried. See `notes` on the interface above. */
const VALUELESS_FIELDS: readonly ContactProfileField[] = ["notes"]

/** Fields stored as a two-letter code, compared case-insensitively. */
const CODE_FIELDS: readonly ContactProfileField[] = ["nationality", "country"]

function cut(value: string): string {
  return value.length > MAX_EVENT_VALUE_CHARS
    ? `${value.slice(0, MAX_EVENT_VALUE_CHARS)}…`
    : value
}

/**
 * A tag list as one comparable string.
 *
 * Sorted and de-duplicated, so re-ordering the comma-separated field in the
 * panel is a no-op rather than an event — the set is what anyone means by
 * "the tags", not the order they happened to type them in.
 */
function normalizeTags(tags: readonly string[] | null | undefined): string | null {
  if (!tags) return null
  const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
  if (unique.length === 0) return null
  return unique.sort((a, b) => a.localeCompare(b, "tr")).join(", ")
}

/**
 * One field's stored value, in the form both sides of a comparison take.
 *
 * Everything empty collapses to null — the panel sends null where the database
 * may hold `""`, and without this every save would report a change nobody made.
 */
function normalize(
  field: ContactProfileField,
  value: string[] | string | null | undefined
): string | null {
  if (value === undefined || value === null) return null
  if (Array.isArray(value)) return normalizeTags(value)

  const trimmed = value.trim()
  if (!trimmed) return null
  return CODE_FIELDS.includes(field) ? trimmed.toUpperCase() : trimmed
}

/**
 * What actually moved between two readings of a card.
 *
 * Every writer runs this rather than trusting the patch it sent: a concurrent
 * write may already have applied the same value, and then the patch claims a
 * change the row never made. Compare against the row that came back.
 *
 * A field missing from `after` is skipped — the writer did not touch it.
 */
export function diffContactProfile(
  before: ContactProfileSnapshot,
  after: ContactProfileSnapshot
): ContactProfileChange[] {
  const changes: ContactProfileChange[] = []

  for (const field of CONTACT_PROFILE_FIELDS) {
    if (after[field] === undefined) continue

    const from = normalize(field, before[field])
    const to = normalize(field, after[field])
    if (from === to) continue

    if (VALUELESS_FIELDS.includes(field)) {
      changes.push({ field })
      continue
    }

    changes.push({
      field,
      from: from === null ? null : cut(from),
      to: to === null ? null : cut(to),
    })
  }

  return changes
}

export function parseContactProfilePayload(
  record: Record<string, unknown>
): ContactProfileUpdatedEvent | null {
  const raw = record.changes
  if (!Array.isArray(raw)) return null

  const changes: ContactProfileChange[] = []

  for (const entry of raw.slice(0, CONTACT_PROFILE_FIELDS.length)) {
    if (typeof entry !== "object" || entry === null) continue
    const item = entry as Record<string, unknown>

    const field = item.field
    if (
      typeof field !== "string" ||
      !(CONTACT_PROFILE_FIELDS as readonly string[]).includes(field)
    ) {
      continue
    }

    // A value-less field stays value-less on the way back out too, even if the
    // row carries values: the guarantee that a staff note never leaves the
    // contacts table has to hold against rows this version did not write.
    if (VALUELESS_FIELDS.includes(field as ContactProfileField)) {
      changes.push({ field: field as ContactProfileField })
      continue
    }

    const from = item.from
    const to = item.to
    // Anything that is not a string or null is not a value we can show. Better
    // no event than "[object Object]" in the middle of a conversation.
    if (!isStoredValue(from) || !isStoredValue(to)) return null

    changes.push({
      field: field as ContactProfileField,
      from: from ?? null,
      to: to ?? null,
    })
  }

  if (changes.length === 0) return null
  return { kind: "contact_profile_updated", changes }
}

function isStoredValue(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || typeof value === "string"
}

/**
 * A stored value as it reads.
 *
 * Codes stay codes in the row and become words here, so correcting a label
 * later corrects every event ever written. An unknown code renders as itself
 * rather than as nothing — a row we cannot translate is still a row that
 * happened.
 */
export function formatContactProfileValue(
  field: ContactProfileField,
  value: string | null | undefined
): string {
  if (!value) return "—"
  if (field === "preferred_language") {
    return PREFERRED_LANGUAGE_LABELS[value as GuestLocale] ?? value
  }
  return value
}

/**
 * The sentence a screen reader hears for one chip.
 *
 * The chip itself is a row of fragments around an arrow, which reads as
 * punctuation and a dash that reads as nothing. This says the same thing in
 * words (WCAG SC 1.4.1).
 */
export function contactProfileChangeText(change: ContactProfileChange): string {
  const label = CONTACT_PROFILE_LABELS[change.field]
  if (!("to" in change)) return `${label} güncellendi`

  const from = change.from ? formatContactProfileValue(change.field, change.from) : "boş"
  const to = change.to ? formatContactProfileValue(change.field, change.to) : "boş"
  return `${label}: ${from} yerine ${to}`
}

/**
 * Who changed the card, and which fields.
 *
 * `actor` is null when the assistant did it, and `{ name: null }` when a
 * teammate whose profile carries no name did — the two must not read the same,
 * which is why this takes the sender rather than a bare name string the way
 * `handoffEventText` does.
 *
 * The assistant goes unnamed. Its line sits directly under the reply it came
 * with, so saying "the assistant" again only repeats what the reader has just
 * read; a teammate is worth naming, because nothing else on the line says who.
 *
 * Labels only, never values. This sentence is also what goes into the row's
 * `body`, and a customer's email in a second column is one that can never be
 * corrected or redacted afterwards. The divider reads the values from the
 * structured payload, so nothing is lost on screen.
 */
export function contactProfileEventText(
  changes: readonly ContactProfileChange[],
  actor: { name?: string | null } | null
): string {
  const fields = changes.map((c) => CONTACT_PROFILE_LABELS[c.field]).join(", ")
  return `${contactProfileEventHeading(actor)}: ${fields}`
}

/**
 * The same sentence without the field list — what the thread shows.
 *
 * On screen the fields are already there, spelled out with their old and new
 * values in the chips underneath, so naming them again in the sentence says the
 * same thing twice. The stored `body` keeps them, because search has only the
 * sentence to go on.
 */
export function contactProfileEventHeading(
  actor: { name?: string | null } | null
): string {
  if (actor === null) return "Kişi kartı güncellendi"
  return `${actor.name?.trim() || "Ekip"} kişi kartını güncelledi`
}

/**
 * The card columns a writer reads before it writes, as one select list.
 *
 * Shared so the three writers cannot drift into diffing different sets of
 * fields — a column missing from one of them would silently stop being
 * announced from that path only.
 */
/**
 * Written out rather than joined from the list above, because supabase-js reads
 * the shape of a row off the *literal* text of the select — `.join()` widens it
 * to `string` and the result comes back untyped. A test asserts the two stay
 * the same list.
 */
export const CONTACT_PROFILE_COLUMNS =
  "first_name, last_name, email, nationality, country, preferred_language, tags, notes"
