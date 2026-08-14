import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"

/**
 * Record who the person is — the handful of identity fields the contact card
 * holds. Only what the customer actually stated; never invent.
 *
 * Situational detail (dates, party size, order status) deliberately has no home
 * here: it belongs to the connected system that owns it, and the assistant
 * fetches it fresh rather than caching a copy that goes stale.
 *
 * Writes the same row staff edit in the inbox. Contact + org id come from the
 * request context (server-set); a service-role client scoped to that org
 * performs the write. The staff-private `notes` field is intentionally NOT
 * writable by the assistant. In the sandbox there is no contact, so this is a
 * no-op.
 */
export const updateContactProfileTool = createTool({
  id: "update_contact_profile",
  description:
    "Save who this person is when they tell you: first name, last name, email, nationality, country, or the language they prefer. Only save what the customer actually said — never guess, and never save something you inferred from their phone number. Provide only what changed.",
  inputSchema: z.object({
    firstName: z
      .string()
      .trim()
      .max(80)
      .optional()
      .describe("Given name, exactly as they wrote it"),
    lastName: z
      .string()
      .trim()
      .max(80)
      .optional()
      .describe("Family name, exactly as they wrote it. Never drop it if they gave it"),
    email: z.string().trim().max(320).optional(),
    nationality: z
      .string()
      .trim()
      .length(2)
      .optional()
      .describe("ISO 3166-1 alpha-2 country code they say they are from, e.g. 'TR', 'DE'"),
    country: z
      .string()
      .trim()
      .length(2)
      .optional()
      .describe("ISO 3166-1 alpha-2 country they are currently in, if they state it"),
    preferredLanguage: z
      .enum(GUEST_LOCALES)
      .optional()
      .describe("Only when they ask to be written to in a specific language"),
  }),
  outputSchema: z.object({ updated: z.boolean() }),
  execute: async (input, context) => {
    const contactId = context?.requestContext?.get("contactId") as
      | string
      | undefined
    const orgId = context?.requestContext?.get("orgId") as string | undefined
    if (!contactId || !orgId) return { updated: false }

    const patch: {
      first_name?: string
      last_name?: string
      email?: string
      nationality?: string
      country?: string
      preferred_language?: string
      updated_at?: string
    } = {}
    if (input.firstName !== undefined) patch.first_name = input.firstName
    if (input.lastName !== undefined) patch.last_name = input.lastName
    if (input.email !== undefined) patch.email = input.email
    if (input.nationality !== undefined) {
      patch.nationality = input.nationality.toUpperCase()
    }
    if (input.country !== undefined) patch.country = input.country.toUpperCase()
    if (input.preferredLanguage !== undefined) {
      patch.preferred_language = input.preferredLanguage
    }

    if (Object.keys(patch).length === 0) return { updated: false }

    // Version signal — lets an already-open inbox panel detect this write and
    // re-sync, even though the contact id itself didn't change.
    patch.updated_at = new Date().toISOString()

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("contacts")
      .update(patch)
      .eq("id", contactId)
      .eq("organization_id", orgId)

    return { updated: !error }
  },
})
