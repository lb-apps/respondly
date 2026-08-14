import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { DELIVERY_AFTER_REPLY } from "@/lib/assistant/delivery"
import {
  CTA_BODY_MAX,
  CTA_TEXT_MAX,
} from "@/lib/whatsapp/cloud-api/payloads"

/**
 * Signal that the agent wants to attach a tappable link button to its reply.
 *
 * Industry-agnostic replacement for the old booking-link CTA: whatever a
 * connected system hands back — a checkout page, an appointment form, an order
 * status page — reaches the customer through this tool instead of a raw URL in
 * the text.
 *
 * Like `send_quick_reply` this does NOT send anything itself; it registers
 * intent. The reply builders turn it into a `{ type: 'cta' }` RichMessage.
 *
 * The input is echoed back in the output so both the WhatsApp path and the
 * dashboard preview can render from the tool *result* alone.
 */
export const sendLinkButtonTool = createTool({
  id: "send_link_button",
  description:
    "Attach a tappable button carrying a link to your reply. Use it whenever you have a URL the customer should act on (checkout, booking, form, appointment, payment, order status). Write `body` and `label` in the CUSTOMER'S language. Never paste the URL into your reply text — the button carries it.",
  inputSchema: z.object({
    url: z.string().url().describe("The link the button opens"),
    imageUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional picture shown above the text, so the customer can see what they are about to pay for. Use a photo you already showed them or one a tool returned for exactly this item — never a generic or decorative image."
      ),
    label: z
      .string()
      .trim()
      .min(1)
      .max(CTA_TEXT_MAX)
      .describe("Button text, ≤20 characters, in the customer's language"),
    body: z
      .string()
      .trim()
      .min(1)
      .max(CTA_BODY_MAX)
      .describe("One short line shown above the button, in the customer's language"),
  }),
  outputSchema: z.object({
    queued: z.literal(true),
    delivery: z.string(),
    url: z.string(),
    imageUrl: z.string().optional(),
    label: z.string(),
    body: z.string(),
  }),
  execute: async ({ url, label, body, imageUrl }) => ({
    queued: true as const,
    delivery: DELIVERY_AFTER_REPLY,
    url,
    ...(imageUrl ? { imageUrl } : {}),
    label,
    body,
  }),
})
