import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { DELIVERY_AFTER_REPLY } from "@/lib/assistant/delivery"
import { cardName, encodeCardTap } from "@/lib/whatsapp/carousel-message"
import {
  CAROUSEL_BODY_MAX,
  CAROUSEL_BUTTON_TEXT_MAX,
  CAROUSEL_CARD_BODY_MAX,
  CAROUSEL_CARD_LINE_BREAK_MAX,
  CAROUSEL_CARD_MAX,
  CAROUSEL_CARD_MIN,
  CAROUSEL_REPLY_MAX,
  clamp,
  fitCardBody,
} from "@/lib/whatsapp/cloud-api/payloads"

/**
 * Show several things side by side, each with its own picture and buttons.
 *
 * The visual sibling of `ask_choice`: that one is for answers you read, this one
 * is for options you look at — rooms, dishes, products. The business decides
 * *what* goes on a card; this tool is where WhatsApp's rules about what fits are
 * written down, so nobody has to repeat them in an assistant's persona.
 *
 * Every limit comes from `cloud-api/limits`, and the trimming is the send
 * layer's own, so what this returns is what the customer receives.
 */
export const showCarouselTool = createTool({
  id: "show_carousel",
  description: [
    "Show 2-10 options as a swipeable row of cards, each with its own photo, a few lines about it, and one or two buttons.",
    "Use it whenever the customer is choosing between things they judge BY LOOKING — rooms with prices, dishes, products, packages — and you have a distinct photo for every one.",
    "Write everything in the CUSTOMER'S language and never repeat the card contents in your reply text.",
    "Do NOT use it without photos, for a single option, or for questions answered with words — use `ask_choice` for those.",
    "",
    "WhatsApp's rules, which this tool cannot bend:",
    `· Between ${CAROUSEL_CARD_MIN} and ${CAROUSEL_CARD_MAX} cards. One option is not a carousel.`,
    `· Every card gets the SAME buttons — that is why the labels are given once, for the whole message, and not per card. One or ${CAROUSEL_REPLY_MAX} of them.`,
    "· A card may carry one link button OR reply buttons, never a mix. So a link is only possible with a single button and a `url` on every card; with two buttons nothing can be a link, and you send the link afterwards when they tap.",
    `· A card body is at most ${CAROUSEL_CARD_LINE_BREAK_MAX} line breaks and ${CAROUSEL_CARD_BODY_MAX} characters. Anything longer is trimmed at a word boundary, so drop the least useful fact yourself rather than letting the cut choose.`,
    "· Card bodies render emphasis, so a discounted price keeps its *bold* and the old one its ~strikethrough~. Button labels do not — marks there arrive as visible characters and are stripped.",
    "· A tap comes back to you naming the card and the button, so you always know which option was chosen.",
  ].join("\n"),
  inputSchema: z.object({
    body: z
      .string()
      .trim()
      .min(1)
      .max(CAROUSEL_BODY_MAX)
      .describe(
        "One line above the cards, in the customer's language. Introduce the set and state what they all share — do not list what is on the cards"
      ),
    buttonLabels: z
      .array(z.string().trim().min(1).max(CAROUSEL_BUTTON_TEXT_MAX))
      .min(1)
      .max(CAROUSEL_REPLY_MAX)
      .describe(
        "The button labels, in the customer's language. Every card gets these same buttons — the cards differ, the actions do not"
      ),
    cards: z
      .array(
        z.object({
          imageUrl: z
            .string()
            .url()
            .describe(
              "Photo of THIS option, from a tool result or the knowledge base. Never a generic or decorative picture, never the same photo on two cards"
            ),
          body: z
            .string()
            .trim()
            // Deliberately looser than what WhatsApp shows: a body a few
            // characters over is trimmed when the message is built, which costs
            // one fact. Rejecting it here would cost the whole turn.
            .max(CAROUSEL_CARD_BODY_MAX * 2)
            .optional()
            .describe(
              `What this option is and everything that decides it, in at most ${CAROUSEL_CARD_LINE_BREAK_MAX + 1} lines and ${CAROUSEL_CARD_BODY_MAX} characters. Start with the name on its own line — it is what the customer sees first and how a tap is reported back to you`
            ),
          url: z
            .string()
            .url()
            .optional()
            .describe(
              "Makes this card's single button open this link. Only possible with exactly one entry in `buttonLabels` and a url on every card"
            ),
        })
      )
      .min(CAROUSEL_CARD_MIN)
      .max(CAROUSEL_CARD_MAX)
      .describe("The options, best match first"),
  }),
  outputSchema: z.object({
    queued: z.literal(true),
    delivery: z.string(),
    body: z.string(),
    cards: z.array(
      z.object({
        id: z.string(),
        imageUrl: z.string(),
        body: z.string().optional(),
        buttons: z.array(
          z.object({
            label: z.string(),
            url: z.string().optional(),
            id: z.string().optional(),
          })
        ),
      })
    ),
  }),
  execute: async ({ body, buttonLabels, cards }) => {
    // A link needs a button of its own, so it only survives when there is one
    // button to give it and every card brought a url. Anything else is a set of
    // reply buttons — the alternative is a message WhatsApp refuses outright.
    const asLinks =
      buttonLabels.length === 1 && cards.every((card) => Boolean(card.url))

    return {
      queued: true as const,
      delivery: DELIVERY_AFTER_REPLY,
      body: clamp(body, CAROUSEL_BODY_MAX),
      cards: cards.map((card, index) => {
        // Trimmed here, with the send layer's own function, so this result is
        // exactly what goes out — and what the inbox stores and replays.
        const cardBody = card.body ? fitCardBody(card.body) : ""
        // Every card carries the same labels, so a tap reported by label alone
        // would not say which card it came from. The card's name is read out of
        // its body and travels inside the id, which Meta hands back untouched.
        const name = cardName(cardBody, `Seçenek ${index + 1}`)
        return {
          id: `card_${index}`,
          imageUrl: card.imageUrl,
          ...(cardBody ? { body: cardBody } : {}),
          buttons: buttonLabels.map((label) => ({
            label: clamp(label, CAROUSEL_BUTTON_TEXT_MAX),
            ...(asLinks && card.url ? { url: card.url } : {}),
            id: encodeCardTap(name, label),
          })),
        }
      }),
    }
  },
})
