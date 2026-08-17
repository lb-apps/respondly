import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { GUEST_LOCALES } from "@/lib/i18n/guest-locale"
import {
  resolveContactProfileStore,
  type ContactRef,
} from "@/lib/contacts/profile-store"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordContactProfileEvent } from "@/lib/inbox/record-thread-event"

/**
 * Record who the person is — the handful of identity fields the contact card
 * holds. Only what the customer actually stated; never invent.
 *
 * Situational detail (dates, party size, order status) deliberately has no home
 * here: it belongs to the connected system that owns it, and the assistant
 * fetches it fresh rather than caching a copy that goes stale.
 *
 * On WhatsApp this writes the same row staff edit in the inbox. In the preview
 * it writes the session's own copy of the persona, so a test run never dirties
 * the card the staff defined. Either way the target comes from the request
 * context (server-set) and the store scopes the write to the org. The
 * staff-written `notes` field is intentionally NOT writable here — the
 * assistant reads it, the team owns it.
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
    const contactRef = context?.requestContext?.get("contactRef") as
      | ContactRef
      | null
      | undefined
    const orgId = context?.requestContext?.get("orgId") as string | undefined
    const conversationId = context?.requestContext?.get("conversationId") as
      | string
      | null
      | undefined

    const store = resolveContactProfileStore({ contactRef, orgId })
    if (!store) return { updated: false }

    const changes = await store.write(input)
    if (changes === null) return { updated: false }

    // What was learned gets a line in the thread, on either surface — watching
    // the assistant pick up a name mid-conversation is the whole point of the
    // preview, and it used to be the one place that never showed it.
    if (changes.length > 0 && orgId && contactRef && conversationId) {
      await recordContactProfileEvent(createAdminClient(), {
        orgId,
        target:
          contactRef.kind === "contact"
            ? { kind: "conversation", conversationId }
            : { kind: "preview_session", sessionId: contactRef.sessionId },
        changes,
      })
    }

    // Reported as saved even when nothing moved: the value the customer gave is
    // what the card holds, which is what the model asked for. Saying "no" to a
    // value that was already correct only invites it to try again.
    return { updated: true }
  },
})
