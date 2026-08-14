import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { DELIVERY_AFTER_REPLY } from "@/lib/assistant/delivery"
import { CHOICE_BUTTON_LIMIT } from "@/lib/whatsapp/choice-message"
import {
  BUTTON_BODY_MAX,
  BUTTON_TITLE_MAX,
  FOOTER_TEXT_MAX,
  LIST_BUTTON_TEXT_MAX,
  LIST_ROW_DESCRIPTION_MAX,
  LIST_ROW_MAX,
  LIST_ROW_TITLE_MAX,
  LIST_SECTION_TITLE_MAX,
} from "@/lib/whatsapp/cloud-api/payloads"

/**
 * Ask the customer a bounded question with pre-set answers.
 *
 * The model describes *intent* — a question and its answers — and the send layer
 * picks the component: a few answers become tappable reply buttons, more become
 * a list sheet, and grouping turns that list into sections. The rules that
 * decide what fits are stated here, on the tool, so a business writing its
 * assistant's persona never has to know them.
 */
export const askChoiceTool = createTool({
  id: "ask_choice",
  description: [
    "Ask the customer a question whose answers you already know, so they can tap instead of typing.",
    "Use it whenever the next step is a bounded choice: a count, a category, a time slot, a yes/no confirmation.",
    "Give the answers in the CUSTOMER'S language, most likely first.",
    "Do NOT use it for open questions (names, e-mails, free-form dates) — ask those in plain text. For options the customer picks by looking at a photo, use `show_carousel`.",
    "",
    "How WhatsApp will render it, which is not yours to choose:",
    `· ${CHOICE_BUTTON_LIMIT} answers or fewer arrive as plain buttons showing a label and nothing else. More arrive as a list sheet, where each answer may also carry a description.`,
    "· So when the descriptions hold the actual difference — a price, a duration — set `descriptionsMatter` and the list is used however few answers there are. Otherwise those details simply would not arrive.",
    "· Answers are truncated to fit, and two answers that end up identical are given a number to keep them apart — write labels that differ early rather than late.",
    "· One question per reply, and never repeat the answers in your reply text; the buttons carry them.",
  ].join("\n"),
  inputSchema: z.object({
    body: z
      .string()
      .trim()
      .min(1)
      .max(BUTTON_BODY_MAX)
      .describe("The question, in the customer's language"),
    options: z
      .array(
        z.object({
          label: z
            .string()
            .trim()
            .min(1)
            .describe(
              `What the customer taps. Cut to ${BUTTON_TITLE_MAX} characters as a button, ${LIST_ROW_TITLE_MAX} as a list row — keep it short enough that neither cuts it mid-word`
            ),
          description: z
            .string()
            .trim()
            .max(LIST_ROW_DESCRIPTION_MAX)
            .optional()
            .describe(
              "One short clarifying line. Shown only in the list form — see `descriptionsMatter`"
            ),
          group: z
            .string()
            .trim()
            .max(LIST_SECTION_TITLE_MAX)
            .optional()
            .describe(
              "Optional heading to group options under, e.g. 'Avrupa' / 'Asya'. Only used in the list form"
            ),
        })
      )
      .min(2)
      .max(LIST_ROW_MAX)
      .describe("The answers, most likely first"),
    listButtonLabel: z
      .string()
      .trim()
      .max(LIST_BUTTON_TEXT_MAX)
      .optional()
      .describe(
        "Label for the button that opens the option sheet in the list form, e.g. 'Seçenekler'. In the customer's language"
      ),
    footer: z
      .string()
      .trim()
      .max(FOOTER_TEXT_MAX)
      .optional()
      .describe("Optional small print under the question"),
    descriptionsMatter: z
      .boolean()
      .optional()
      .describe(
        "Set true when the descriptions carry information the labels do not — a price, a duration, a condition — so the customer cannot choose without reading them. Leave it off when the labels stand on their own."
      ),
  }),
  outputSchema: z.object({
    queued: z.literal(true),
    delivery: z.string(),
    body: z.string(),
    options: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string().optional(),
        group: z.string().optional(),
      })
    ),
    listButtonLabel: z.string().optional(),
    footer: z.string().optional(),
    descriptionsMatter: z.boolean().optional(),
  }),
  execute: async ({ body, options, listButtonLabel, footer, descriptionsMatter }) => ({
    queued: true as const,
    delivery: DELIVERY_AFTER_REPLY,
    body,
    // Ids are assigned here so the webhook can match a tap back to the option
    // even when the label was truncated for display.
    options: options.map((option, index) => ({
      id: `opt_${index}`,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
      ...(option.group ? { group: option.group } : {}),
    })),
    ...(listButtonLabel ? { listButtonLabel } : {}),
    ...(footer ? { footer } : {}),
    ...(descriptionsMatter ? { descriptionsMatter } : {}),
  }),
})
