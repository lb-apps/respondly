import type { McpServerSummary } from "@/lib/mcp/types"

/**
 * Every tool an author can point the assistant at from the prompt editor.
 *
 * Two sources, one list. The built-ins ship with the product and exist for
 * every organization; the rest are discovered from whatever MCP servers this
 * organization connected. Grouping keeps that distinction visible — "why can I
 * write this one but not that one" should be answerable at a glance.
 *
 * Pure function, so the ordering and filtering rules are testable without a DOM.
 */

export interface MentionableTool {
  /** Exactly the name the model sees, which is what gets written. */
  name: string
  description: string
}

export interface MentionableGroup {
  id: string
  label: string
  tools: MentionableTool[]
}

/**
 * Tools the assistant always has. Descriptions are the author's view, not the
 * model's: they answer "what happens if I tell it to use this", in Turkish,
 * like the rest of the dashboard.
 */
const BUILT_IN_TOOLS: MentionableTool[] = [
  {
    name: "search_knowledge",
    description:
      "Bilgi kütüphanesinde arar. Her olgusal cevaptan önce çağrılır.",
  },
  {
    name: "ask_choice",
    description: "Cevabı belli bir soruyu dokunulabilir seçeneklerle sorar.",
  },
  {
    name: "show_carousel",
    description:
      "Fotoğraflı seçenekleri yan yana kaydırmalı kartlar olarak gösterir.",
  },
  {
    name: "send_link_button",
    description: "Bir bağlantıyı buton olarak gönderir.",
  },
  {
    name: "send_location",
    description: "Adresi haritada dokunulabilir bir konum olarak gönderir.",
  },
  {
    name: "request_location",
    description: "Müşterinin konumunu paylaşmasını ister.",
  },
  {
    name: "flag_source_conflict",
    description: "İki kaynak çelişince ekibe işaret bırakır.",
  },
  {
    name: "get_contact_profile",
    description: "Kişi kartındaki bilgileri okur.",
  },
  {
    name: "update_contact_profile",
    description: "Kişi kartını öğrendiği bilgiyle günceller.",
  },
]

export const BUILT_IN_GROUP_ID = "built-in"

export function buildMentionableGroups(
  servers: McpServerSummary[],
): MentionableGroup[] {
  const groups: MentionableGroup[] = [
    {
      id: BUILT_IN_GROUP_ID,
      label: "Yerleşik araçlar",
      tools: BUILT_IN_TOOLS,
    },
  ]

  for (const server of servers) {
    if (server.tools.length === 0) continue
    groups.push({
      id: server.slug,
      label: server.name,
      tools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    })
  }

  return groups
}

/**
 * Narrow the list to what the author has typed after the `@`.
 *
 * Matches on the tool name only. Descriptions are prose and would make a short
 * query match nearly everything, which is worse than no filtering at all. An
 * empty query keeps the whole list, so `@` on its own is a browsable menu.
 */
export function filterMentionableGroups(
  groups: MentionableGroup[],
  query: string,
): MentionableGroup[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return groups

  return groups
    .map((group) => ({
      ...group,
      tools: group.tools.filter((tool) =>
        tool.name.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.tools.length > 0)
}

/** Flat list in display order — what arrow keys walk through. */
export function flattenGroups(groups: MentionableGroup[]): MentionableTool[] {
  return groups.flatMap((group) => group.tools)
}
