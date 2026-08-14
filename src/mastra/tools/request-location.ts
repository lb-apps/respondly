import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { DELIVERY_AFTER_REPLY } from "@/lib/assistant/delivery"
import { LOCATION_REQUEST_BODY_MAX } from "@/lib/whatsapp/cloud-api/payloads"

/**
 * Ask the customer to share their location via WhatsApp's native picker.
 *
 * Intent only — the reply builders turn it into a `location_request`
 * RichMessage that the send layer delivers as an interactive message.
 */
export const requestLocationTool = createTool({
  id: "request_location",
  description:
    "Ask the customer to share their location with a native 'Send location' button. Use it only when you genuinely need where they are — directions from their current spot, a pickup point, a delivery address. Do not use it to ask which city they live in; ask that in plain text. Write `body` in the CUSTOMER'S language.",
  inputSchema: z.object({
    body: z
      .string()
      .trim()
      .min(1)
      .max(LOCATION_REQUEST_BODY_MAX)
      .describe("Why you need it, in the customer's language"),
  }),
  outputSchema: z.object({
    queued: z.literal(true),
    delivery: z.string(),
    body: z.string(),
  }),
  execute: async ({ body }) => ({
    queued: true as const,
    delivery: DELIVERY_AFTER_REPLY,
    body,
  }),
})
