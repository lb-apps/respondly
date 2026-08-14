import { createTool } from "@mastra/core/tools"
import { z } from "zod"

const conflictEntrySchema = z.object({
  sourceId: z
    .string()
    .uuid()
    .describe("sourceId from the search_knowledge passage"),
  value: z
    .string()
    .max(200)
    .describe("The conflicting fact this source states (e.g. '14:00')"),
  quote: z
    .string()
    .max(400)
    .describe(
      "Short verbatim excerpt copied from that passage so staff can locate it in the source"
    ),
})

/**
 * Records contradictory knowledge-base facts for the preview dashboard.
 * The assistant still answers the guest with its best value; this tool only
 * surfaces conflicts to staff via the preview UI chip.
 */
export const flagSourceConflictTool = createTool({
  id: "flag_source_conflict",
  description:
    "Flag when two or more search_knowledge passages contradict each other on the same factual attribute (e.g. different check-in times). Call once per contradiction topic. Still answer the guest normally — do NOT mention the conflict in your reply text.",
  inputSchema: z.object({
    topic: z
      .string()
      .max(120)
      .describe(
        "Short label for what conflicts (e.g. 'check-in time', 'parking fee')"
      ),
    conflicts: z
      .array(conflictEntrySchema)
      .min(2)
      .max(6)
      .describe("At least two sources with different values for the same topic"),
  }),
  outputSchema: z.object({
    recorded: z.literal(true),
    topic: z.string(),
    conflicts: z.array(conflictEntrySchema),
  }),
  execute: async ({ topic, conflicts }, context) => {
    const orgId = context?.requestContext?.get("orgId") as string | undefined
    if (!orgId) {
      return { recorded: true as const, topic, conflicts: [] }
    }

    return {
      recorded: true as const,
      topic: topic.trim(),
      conflicts: conflicts.map((c) => ({
        sourceId: c.sourceId,
        value: c.value.trim(),
        quote: c.quote.trim(),
      })),
    }
  },
})
