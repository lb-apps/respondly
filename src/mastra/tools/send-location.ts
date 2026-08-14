import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { DELIVERY_AFTER_REPLY } from "@/lib/assistant/delivery"
import {
  LOCATION_ADDRESS_MAX,
  LOCATION_NAME_MAX,
} from "@/lib/whatsapp/cloud-api/payloads"

/**
 * Send a place as a map pin.
 *
 * A street address typed into a chat is something the customer has to copy out
 * and paste into a map. A pin is something they tap, and their own map app opens
 * with directions already possible. For "where are you?" the pin is the answer
 * and the text is the footnote, not the other way round.
 *
 * Coordinates are the one field here that cannot be approximated: a plausible
 * pair puts the customer on the wrong street with no sign anything went wrong.
 * The range check below only catches nonsense — that the numbers describe *this*
 * business is enforced by the same grounding rule as every other specific, and
 * the model is told as much in its description.
 *
 * Registers intent only, like the other rich-content tools; the reply builders
 * turn it into a `location` RichMessage.
 */
export const sendLocationTool = createTool({
  id: "send_location",
  description:
    "Send a place as a tappable map pin — use this whenever you give an address, directions, or a meeting point, instead of writing the address into your reply. The customer taps it and their map app opens. Latitude and longitude MUST be copied from a tool result or a knowledge-base passage from this turn; never estimate them, never derive them from a district or street name, and never reuse coordinates from memory. If you do not have exact coordinates, do not call this tool.",
  inputSchema: z.object({
    latitude: z
      .number()
      .min(-90)
      .max(90)
      .describe("Decimal degrees, copied verbatim from a source"),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe("Decimal degrees, copied verbatim from a source"),
    name: z
      .string()
      .trim()
      .max(LOCATION_NAME_MAX)
      .optional()
      .describe("What the place is called, e.g. the business name"),
    address: z
      .string()
      .trim()
      .max(LOCATION_ADDRESS_MAX)
      .optional()
      .describe(
        "Street address as it appears in the source. Copy it; do not assemble it"
      ),
  }),
  outputSchema: z.object({
    queued: z.literal(true),
    delivery: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
    address: z.string().optional(),
  }),
  execute: async ({ latitude, longitude, name, address }) => ({
    queued: true as const,
    delivery: DELIVERY_AFTER_REPLY,
    latitude,
    longitude,
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
  }),
})
