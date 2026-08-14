/**
 * Reading a place the customer shared.
 *
 * `request_location` puts a "send location" button in front of them, and what
 * comes back is a `location` message — coordinates always, a name and address
 * only if they chose to send them. The webhook had no branch for it, so the
 * message carried no text, no media, and was dropped before it reached the
 * assistant: we asked where they were and then never heard the answer.
 *
 * Pure, so the shape can be asserted against the payload Meta documents.
 */

export interface SharedLocation {
  latitude?: number
  longitude?: number
  name?: string
  address?: string
}

/** Six decimals is roughly a tenth of a metre — past that is noise. */
const COORDINATE_DECIMALS = 6

/**
 * One line describing the place, or null when there is nothing to describe.
 *
 * Deliberately free of any language: this text becomes the customer's message
 * in the transcript, and a Turkish word here would both mislead the language
 * detection and read oddly to a German guest. The coordinates lead because they
 * are the part that is always present and always exact.
 */
export function describeSharedLocation(
  location: SharedLocation | undefined | null
): string | null {
  if (!location) return null
  const { latitude, longitude } = location
  if (typeof latitude !== "number" || typeof longitude !== "number") return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const point = `${latitude.toFixed(COORDINATE_DECIMALS)}, ${longitude.toFixed(
    COORDINATE_DECIMALS
  )}`
  const label = [location.name?.trim(), location.address?.trim()]
    .filter(Boolean)
    .join(", ")

  return label ? `[location] ${point} — ${label}` : `[location] ${point}`
}

/** The same place as structured data, for the inbox map and for tools. */
export function sharedLocationMetadata(
  location: SharedLocation | undefined | null
): Record<string, unknown> | null {
  if (!location) return null
  const { latitude, longitude } = location
  if (typeof latitude !== "number" || typeof longitude !== "number") return null

  return {
    location: {
      latitude,
      longitude,
      ...(location.name?.trim() ? { name: location.name.trim() } : {}),
      ...(location.address?.trim() ? { address: location.address.trim() } : {}),
    },
  }
}
