import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  extractSourceConflicts,
  extractUsedSources,
  extractUsedTools,
  toolNameFromPart,
} from "@/components/chat/message-chips"

/**
 * These extractors decide what the inbox and the preview show under an
 * assistant message. They had no tests before being shared; the shape they
 * parse is produced in two different places now, so a drift here is silent.
 */

function dynamicTool(toolName: string, output?: unknown, input?: unknown) {
  return { type: "dynamic-tool", toolName, output, input }
}

/** The AI SDK's native shape, which the preview can also receive. */
function nativeTool(name: string, output?: unknown, input?: unknown) {
  return { type: `tool-${name}`, output, input }
}

function knowledge(passages: unknown[]) {
  return dynamicTool("search_knowledge", { passages })
}

describe("toolNameFromPart", () => {
  it("reads both part conventions", () => {
    assert.equal(toolNameFromPart({ type: "dynamic-tool", toolName: "a" }), "a")
    assert.equal(toolNameFromPart({ type: "tool-b" }), "b")
  })

  it("returns empty for a text part", () => {
    assert.equal(toolNameFromPart({ type: "text", text: "merhaba" }), "")
  })
})

describe("extractUsedTools", () => {
  it("leaves out the two tools that have their own chip", () => {
    const tools = extractUsedTools([
      knowledge([]),
      dynamicTool("flag_source_conflict"),
      dynamicTool("send_link_button"),
    ])
    assert.deepEqual(
      tools.map((t) => t.name),
      ["send_link_button"]
    )
  })

  it("counts a tool once however many times it ran", () => {
    const tools = extractUsedTools([
      dynamicTool("mydora_search_availability"),
      dynamicTool("mydora_search_availability"),
    ])
    assert.equal(tools.length, 1)
  })

  it("labels known tools in Turkish and humanizes the rest", () => {
    const [known, unknown] = extractUsedTools([
      dynamicTool("send_link_button"),
      dynamicTool("mydora_search_availability"),
    ])
    assert.equal(known?.label, "Bağlantı butonu")
    assert.equal(unknown?.label, "Mydora Search Availability")
  })

  it("recognises the native tool-<name> shape too", () => {
    assert.deepEqual(
      extractUsedTools([nativeTool("show_carousel")]).map((t) => t.label),
      ["Kart galerisi"]
    )
  })

  it("ignores text parts and junk", () => {
    assert.deepEqual(extractUsedTools([{ type: "text", text: "x" }, null, 5]), [])
  })
})

describe("extractUsedSources", () => {
  it("dedupes by source id across passages and calls", () => {
    const sources = extractUsedSources([
      knowledge([
        { sourceId: "s1", sourceName: "Oda", sourceKind: "file" },
        { sourceId: "s1", sourceName: "Oda", sourceKind: "file" },
      ]),
      knowledge([{ sourceId: "s2", sourceName: "Kahvaltı", sourceKind: "link" }]),
    ])
    assert.deepEqual(
      sources.map((s) => s.id),
      ["s1", "s2"]
    )
  })

  it("defaults an unlabelled kind to text", () => {
    const [source] = extractUsedSources([knowledge([{ sourceId: "s1", sourceName: "A" }])])
    assert.equal(source?.kind, "text")
  })

  it("skips passages with no id or no name", () => {
    assert.deepEqual(
      extractUsedSources([knowledge([{ sourceId: "s1" }, { sourceName: "A" }])]),
      []
    )
  })

  it("ignores every tool other than search_knowledge", () => {
    assert.deepEqual(
      extractUsedSources([
        dynamicTool("mydora_search_availability", {
          passages: [{ sourceId: "s1", sourceName: "A" }],
        }),
      ]),
      []
    )
  })
})

describe("extractSourceConflicts", () => {
  const conflicts = [
    { sourceId: "s1", value: "07:00", quote: "07:00'de başlar" },
    { sourceId: "s2", value: "08:00", quote: "08:00'de başlar" },
  ]
  const sourceMap = new Map([
    ["s1", { name: "Oda notu", kind: "file" }],
    ["s2", { name: "Web sitesi", kind: "link" }],
  ])

  it("reads the output when the tool confirmed the record", () => {
    const [group] = extractSourceConflicts(
      [dynamicTool("flag_source_conflict", { recorded: true, topic: "Kahvaltı", conflicts })],
      sourceMap
    )
    assert.equal(group?.topic, "Kahvaltı")
    assert.equal(group?.sources.length, 2)
    assert.equal(group?.sources[0]?.name, "Oda notu")
  })

  it("falls back to the input when it did not", () => {
    const [group] = extractSourceConflicts(
      [dynamicTool("flag_source_conflict", { recorded: false }, { topic: "Kahvaltı", conflicts })],
      sourceMap
    )
    assert.equal(group?.topic, "Kahvaltı")
  })

  it("names a source we never saw in a search", () => {
    const [group] = extractSourceConflicts(
      [dynamicTool("flag_source_conflict", { recorded: true, topic: "Kahvaltı", conflicts })],
      new Map()
    )
    assert.equal(group?.sources[0]?.name, "Kaynak")
    assert.equal(group?.sources[0]?.kind, "text")
  })

  it("drops a group with fewer than two sources — one source disagrees with nothing", () => {
    assert.deepEqual(
      extractSourceConflicts(
        [
          dynamicTool("flag_source_conflict", {
            recorded: true,
            topic: "Kahvaltı",
            conflicts: [conflicts[0]],
          }),
        ],
        sourceMap
      ),
      []
    )
  })

  it("drops a group with no topic", () => {
    assert.deepEqual(
      extractSourceConflicts(
        [dynamicTool("flag_source_conflict", { recorded: true, topic: "  ", conflicts })],
        sourceMap
      ),
      []
    )
  })
})
