import { PREFERRED_LANGUAGE_LABELS } from "@/lib/contacts/identity"
import { normalizeGuestLocale, isGuestLocale } from "@/lib/i18n/guest-locale"

/**
 * What we already know about the person, rendered into the per-turn prompt.
 *
 * The assistant should never spend a tool call — or worse, a question to the
 * customer — on something already on the contact card. The phone number
 * especially: they are messaging us on WhatsApp, so asking for it is nonsense.
 *
 * Pure function; the caller supplies the row.
 */

export interface ContactContext {
  firstName?: string | null
  lastName?: string | null
  /** E.164, as stored. Given to the model for tool arguments, not for display. */
  phone?: string | null
  email?: string | null
  nationality?: string | null
  country?: string | null
  preferredLanguage?: string | null
}

/**
 * Build the "what we already know" block, or null when the conversation has no
 * contact behind it (the dashboard sandbox).
 */
export function buildContactContextBlock(
  contact: ContactContext | null | undefined
): string | null {
  if (!contact) return null

  const known: string[] = []
  const firstName = contact.firstName?.trim()
  const lastName = contact.lastName?.trim()
  const phone = contact.phone?.trim()
  const email = contact.email?.trim()
  const nationality = contact.nationality?.trim()
  const country = contact.country?.trim()
  const preferred = contact.preferredLanguage?.trim()

  if (firstName) known.push(`- First name: ${firstName}`)
  if (lastName) known.push(`- Last name: ${lastName}`)
  if (phone) known.push(`- Phone (E.164): ${phone}`)
  if (email) known.push(`- Email: ${email}`)
  if (nationality) known.push(`- Nationality: ${nationality}`)
  if (country) {
    known.push(`- Country (from their phone number, unconfirmed): ${country}`)
  }
  if (preferred && isGuestLocale(preferred)) {
    known.push(
      `- Preferred language: ${PREFERRED_LANGUAGE_LABELS[normalizeGuestLocale(preferred)]} (${preferred})`
    )
  }

  const missing: string[] = []
  if (!firstName) missing.push("first name")
  if (!lastName) missing.push("last name")
  if (!email) missing.push("email")
  if (!nationality) missing.push("nationality")

  const facts =
    known.length > 0
      ? known.join("\n")
      : "- Nothing beyond their phone number yet."

  return `## What We Already Know (this person)

${facts}
${missing.length > 0 ? `\nNot recorded yet: ${missing.join(", ")}.` : ""}

Rules:
- Treat everything above as already answered. Never ask the customer for any of it again.
- **Never ask for their phone number.** They are messaging us on WhatsApp; the number above is theirs. When a tool needs a phone number, pass that value.
- When a tool needs a detail listed above, fill it in silently. Only ask for what is genuinely missing, and ask for one thing at a time — never a list of fields in one message.
- Country is a guess from their dialling code. Never state it back as fact, and never treat it as their nationality. Ask if it matters.
- Do not read this list back to them, and do not repeat their own phone number unless they ask for it.
- When they tell you one of these details, save it with \`update_contact_profile\`. If something here contradicts what they say now, believe them and save the correction.`
}
