import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  BUILT_IN_GROUP_ID,
  buildMentionableGroups,
  filterMentionableGroups,
  flattenGroups,
} from "@/lib/assistant/mentionable-tools"
import type { McpServerSummary } from "@/lib/mcp/types"

const servers: McpServerSummary[] = [
  {
    slug: "mydora",
    name: "My Dora Web Sitesi",
    tools: [
      {
        name: "mydora_search_availability",
        originalName: "search_availability",
        description: "Live rooms and prices.",
      },
      {
        name: "mydora_get_photos",
        originalName: "get_photos",
        description: "Photos of a room or area.",
      },
    ],
  },
]

describe("buildMentionableGroups", () => {
  it("puts the built-in tools first, then each connected system", () => {
    const groups = buildMentionableGroups(servers)
    assert.equal(groups[0].id, BUILT_IN_GROUP_ID)
    assert.equal(groups[1].id, "mydora")
    assert.equal(groups[1].label, "My Dora Web Sitesi")
  })

  it("offers the namespaced name, which is what the model is given", () => {
    const groups = buildMentionableGroups(servers)
    const names = groups[1].tools.map((t) => t.name)
    assert.deepEqual(names, ["mydora_search_availability", "mydora_get_photos"])
  })

  it("still offers the built-ins when nothing is connected", () => {
    const groups = buildMentionableGroups([])
    assert.equal(groups.length, 1)
    assert.ok(groups[0].tools.some((t) => t.name === "search_knowledge"))
  })

  it("skips a server that advertised no tools", () => {
    const groups = buildMentionableGroups([
      { slug: "empty", name: "Boş", tools: [] },
    ])
    assert.equal(groups.length, 1)
  })
})

describe("filterMentionableGroups", () => {
  const groups = buildMentionableGroups(servers)

  it("keeps everything for an empty query, so @ alone is a menu", () => {
    assert.deepEqual(filterMentionableGroups(groups, ""), groups)
  })

  it("matches anywhere in the name, not just the start", () => {
    const found = filterMentionableGroups(groups, "photos")
    assert.deepEqual(flattenGroups(found).map((t) => t.name), [
      "mydora_get_photos",
    ])
  })

  it("is case-insensitive", () => {
    assert.equal(flattenGroups(filterMentionableGroups(groups, "PHOTOS")).length, 1)
  })

  it("drops groups that have no match left", () => {
    const found = filterMentionableGroups(groups, "knowledge")
    assert.equal(found.length, 1)
    assert.equal(found[0].id, BUILT_IN_GROUP_ID)
  })

  it("does not match on description text", () => {
    // "Live rooms and prices" must not surface for a name search.
    assert.equal(filterMentionableGroups(groups, "prices").length, 0)
  })
})
