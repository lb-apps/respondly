import {
  parsePhoneNumber,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/core"
import metadataRaw from "libphonenumber-js/min/metadata"

// Pure libphonenumber-js/core only — no React deps. This module is imported
// from server-only paths (e.g. the WhatsApp webhook), so it must stay
// isomorphic. We pass metadata explicitly and unwrap the `{ default }` shape
// some bundlers/loaders (tsx ESM interop) produce for JSON imports.
const metadata = (metadataRaw as { default?: unknown }).default ?? metadataRaw

function tryParse(candidate: string): PhoneNumber | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsePhoneNumber(candidate, metadata as any)
  } catch {
    return undefined
  }
}

function parsePhone(input: string): PhoneNumber | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const withPlus = trimmed.startsWith("+")
    ? trimmed
    : `+${trimmed.replace(/[^\d]/g, "")}`

  const parsed = tryParse(withPlus)
  if (parsed?.isValid()) return parsed

  return tryParse(trimmed)
}

/** Storage, API, WhatsApp send — always E.164 with leading `+`. */
export function normalizePhoneE164(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""

  const parsed = parsePhone(trimmed)
  if (parsed) return parsed.format("E.164")

  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "")
  const digits = trimmed.replace(/[^\d]/g, "")
  return digits ? `+${digits}` : ""
}

/** All UI display — international format with spaces. */
export function formatPhoneDisplay(input: string | null | undefined): string {
  if (!input?.trim()) return "—"

  const parsed = parsePhone(input)
  if (parsed) return parsed.formatInternational()

  const normalized = normalizePhoneE164(input)
  return normalized || input.trim()
}

export function getPhoneCountry(
  input: string | null | undefined
): CountryCode | undefined {
  if (!input?.trim()) return undefined
  return parsePhone(input)?.country
}

export function isValidPhone(input: string | null | undefined): boolean {
  if (!input?.trim()) return false
  return parsePhone(input)?.isValid() ?? false
}

/** wa.me deep link — digits only, no `+`. */
export function toWhatsAppHref(input: string): string {
  const e164 = normalizePhoneE164(input)
  const digits = e164.replace(/[^\d]/g, "")
  return digits ? `https://wa.me/${digits}` : ""
}
