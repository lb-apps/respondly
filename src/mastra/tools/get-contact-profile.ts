import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"

/**
 * Read the contact card for the person in this conversation.
 *
 * The same fields are injected into the system prompt every turn (see
 * `buildContactContextBlock`), so this tool is a fallback for a re-read rather
 * than the primary path.
 *
 * Reads the contact + org id from the request context (server-set, never client
 * input) and fetches with a service-role client scoped to that org. In the
 * sandbox there is no contact, so it returns `found: false` and the assistant
 * simply proceeds without prior knowledge.
 */
export const getContactProfileTool = createTool({
  id: "get_contact_profile",
  description:
    "Get the contact card for this person: first name, last name, phone, email, nationality, country, preferred language. These are already in your context each turn — call this only to double-check a value you are about to write somewhere important.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    found: z.boolean(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    preferredLanguage: z.enum(GUEST_LOCALES).nullable().optional(),
  }),
  execute: async (_input, context) => {
    const contactId = context?.requestContext?.get("contactId") as
      | string
      | undefined
    const orgId = context?.requestContext?.get("orgId") as string | undefined
    if (!contactId || !orgId) return { found: false }

    const supabase = createAdminClient()
    const { data } = await supabase
      .from("contacts")
      .select(
        "first_name, last_name, phone, email, nationality, country, preferred_language"
      )
      .eq("id", contactId)
      .eq("organization_id", orgId)
      .maybeSingle()

    if (!data) return { found: false }

    const preferred = GUEST_LOCALES.find(
      (locale) => locale === data.preferred_language
    )

    return {
      found: true,
      firstName: data.first_name,
      lastName: data.last_name,
      // E.164 — the number they message us from. Pass it to tools that need a
      // phone number instead of asking the customer for it.
      phone: data.phone,
      email: data.email,
      nationality: data.nationality,
      country: data.country,
      preferredLanguage: preferred ?? null,
    }
  },
})
