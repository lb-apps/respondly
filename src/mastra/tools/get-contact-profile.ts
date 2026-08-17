import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"
import {
  resolveContactProfileStore,
  type ContactRef,
} from "@/lib/contacts/profile-store"

/**
 * Read the contact card for the person in this conversation.
 *
 * The same fields are injected into the system prompt every turn (see
 * `buildContactContextBlock`), so this tool is a fallback for a re-read rather
 * than the primary path.
 *
 * Where that person lives — a real contact on WhatsApp, a session-scoped
 * persona in the preview — comes from the request context (server-set, never
 * client input) and is resolved to a `ContactProfileStore`. When the turn has
 * no person behind it at all, it returns `found: false` and the assistant
 * proceeds without prior knowledge.
 */
export const getContactProfileTool = createTool({
  id: "get_contact_profile",
  description:
    "Get the contact card for this person: first name, last name, phone, email, nationality, country, preferred language, and the team's own note about them. These are already in your context each turn — call this only to double-check a value you are about to write somewhere important.",
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
    notes: z.string().nullable().optional(),
  }),
  execute: async (_input, context) => {
    const store = resolveContactProfileStore({
      contactRef: context?.requestContext?.get("contactRef") as
        | ContactRef
        | null
        | undefined,
      orgId: context?.requestContext?.get("orgId") as string | undefined,
    })
    if (!store) return { found: false }

    const profile = await store.read()
    if (!profile) return { found: false }

    const preferred = GUEST_LOCALES.find(
      (locale) => locale === profile.preferredLanguage
    )

    return {
      found: true,
      firstName: profile.firstName,
      lastName: profile.lastName,
      // E.164 — the number they message us from. Pass it to tools that need a
      // phone number instead of asking the customer for it.
      phone: profile.phone,
      email: profile.email,
      nationality: profile.nationality,
      country: profile.country,
      preferredLanguage: preferred ?? null,
      // Written by the team about this person. Background for you, never
      // something to read back to them.
      notes: profile.notes,
    }
  },
})
