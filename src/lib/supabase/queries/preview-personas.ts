import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import { PERSONA_SEEDS } from "@/lib/assistant/preview/persona-seeds"

type DB = SupabaseClient<Database>

/**
 * The mock contact cards the preview runs against.
 *
 * Same shape as a real contact — that is the whole point — plus `label`, the
 * card's own name in the picker. `name` is not stored: on `contacts` a trigger
 * derives it, so here it is derived too (`fullName`), and there is one rule
 * rather than two.
 */
export interface PreviewPersona {
  id: string
  label: string
  phone: string
  firstName: string | null
  lastName: string | null
  email: string | null
  nationality: string | null
  country: string | null
  preferredLanguage: string | null
  tags: string[]
  notes: string | null
}

const PERSONA_COLUMNS =
  "id, label, phone, first_name, last_name, email, nationality, country, preferred_language, tags, notes"

type PersonaRow = {
  id: string
  label: string
  phone: string
  first_name: string | null
  last_name: string | null
  email: string | null
  nationality: string | null
  country: string | null
  preferred_language: string | null
  tags: string[]
  notes: string | null
}

export function rowToPersona(row: PersonaRow): PreviewPersona {
  return {
    id: row.id,
    label: row.label,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    nationality: row.nationality,
    country: row.country,
    preferredLanguage: row.preferred_language,
    tags: row.tags,
    notes: row.notes,
  }
}

async function selectPersonas(
  supabase: DB,
  organizationId: string
): Promise<PreviewPersona[]> {
  const { data, error } = await supabase
    .from("assistant_preview_personas")
    .select(PERSONA_COLUMNS)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error || !data) return []
  return data.map(rowToPersona)
}

/**
 * List the org's personas, seeding the starter set the first time.
 *
 * Seeding lives here rather than in the migration so an organization created
 * later gets the same cards — and so editing or deleting one is permanent
 * instead of being undone by the next deploy. The insert ignores conflicts, so
 * two tabs opening the page at once cannot double up.
 */
export async function listPreviewPersonas(
  organizationId: string
): Promise<PreviewPersona[]> {
  const supabase = await createClient()

  const existing = await selectPersonas(supabase, organizationId)
  if (existing.length > 0) return existing

  const { error } = await supabase.from("assistant_preview_personas").insert(
    PERSONA_SEEDS.map((seed, index) => ({
      organization_id: organizationId,
      label: seed.label,
      phone: seed.phone,
      first_name: seed.firstName ?? null,
      last_name: seed.lastName ?? null,
      email: seed.email ?? null,
      nationality: seed.nationality ?? null,
      country: seed.country ?? null,
      preferred_language: seed.preferredLanguage ?? null,
      tags: seed.tags ?? [],
      notes: seed.notes ?? null,
      sort_order: index,
    }))
  )

  // A conflict means another request seeded first — read theirs.
  if (error && error.code !== "23505") return []

  return selectPersonas(supabase, organizationId)
}

export async function getPreviewPersona(
  supabase: DB,
  args: { personaId: string; organizationId: string }
): Promise<PreviewPersona | null> {
  const { data } = await supabase
    .from("assistant_preview_personas")
    .select(PERSONA_COLUMNS)
    .eq("id", args.personaId)
    .eq("organization_id", args.organizationId)
    .maybeSingle()

  return data ? rowToPersona(data) : null
}
