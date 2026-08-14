import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { DELIVERY_IMAGES_AFTER_REPLY } from "@/lib/assistant/delivery"
import { createAdminClient } from "@/lib/supabase/admin"
import { retrieveChunks } from "@/lib/knowledge/retrieve"

/**
 * RAG grounding tool. The assistant MUST call this before answering any factual
 * question (price, policy, rooms, amenities, location). Returns matching
 * knowledge-base passages, or empty when nothing is relevant — in which case
 * the assistant must hand off to a human, never invent an answer.
 *
 * Reads org/assistant ids from the request context (set server-side, never
 * from client input) and retrieves with a service-role client filtered by that
 * org id — so it works both in the cookie-bound sandbox and the cookieless
 * WhatsApp webhook, without ever crossing org boundaries.
 */
export const searchKnowledgeTool = createTool({
  id: "search_knowledge",
  description:
    "Search the organization's knowledge base. Call this before answering any factual question about prices, policies, rooms, amenities, or location. If the result is empty (found=false), you have no information — hand off to a human, never guess.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search phrase derived from the guest's question"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    /** Only when a passage carries an image — see `DELIVERY_IMAGES_AFTER_REPLY`. */
    imageDelivery: z.string().optional(),
    passages: z.array(
      z.object({
        sourceId: z.string(),
        sourceName: z.string(),
        sourceKind: z.string(),
        sourceCategory: z.string(),
        content: z.string(),
        similarity: z.number(),
        imageUrl: z.string().nullable().optional(),
      })
    ),
  }),
  execute: async ({ query }, context) => {
    const orgId = context?.requestContext?.get("orgId") as string | undefined
    const assistantId =
      (context?.requestContext?.get("assistantId") as string | undefined) ??
      null
    if (!orgId) {
      return { found: false, passages: [] }
    }

    const supabase = createAdminClient()
    const chunks = await retrieveChunks(supabase, {
      orgId,
      assistantId,
      query,
    })

    if (chunks.length === 0) return { found: false, passages: [] }

    // Fetch source titles + kinds for the returned chunks.
    const uniqueSourceIds = [...new Set(chunks.map((c) => c.sourceId))]
    const { data: sources } = await supabase
      .from("knowledge_sources")
      .select("id, title, kind, category")
      .in("id", uniqueSourceIds)
    const sourceMap = new Map((sources ?? []).map((s) => [s.id, s]))


    // Cap each passage so a long chunk can't blow up the tool-result tokens.
    const MAX_PASSAGE_CHARS = 600
    const hasImages = chunks.some((c) => c.imageUrl)

    return {
      found: true,
      ...(hasImages ? { imageDelivery: DELIVERY_IMAGES_AFTER_REPLY } : {}),
      passages: chunks.map((c) => ({
        sourceId: c.sourceId,
        sourceName: sourceMap.get(c.sourceId)?.title ?? "",
        sourceKind: sourceMap.get(c.sourceId)?.kind ?? "text",
        sourceCategory: sourceMap.get(c.sourceId)?.category ?? "reference",
        content:
          c.content.length > MAX_PASSAGE_CHARS
            ? c.content.slice(0, MAX_PASSAGE_CHARS) + "…"
            : c.content,
        similarity: c.similarity,
        imageUrl: c.imageUrl ?? null,
      })),
    }
  },
})
