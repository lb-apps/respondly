import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  TOOL_TRACE_INPUT_MAX,
  TOOL_TRACE_MAX_PARTS,
  buildToolTrace,
  type ToolTracePart,
} from "@/lib/assistant/tool-trace"
import type { ToolResultLike } from "@/mastra/tool-results"

function result(toolName: string, output?: unknown, args?: unknown): ToolResultLike {
  return { toolName, payload: { output, args, input: args }, result: output, args }
}

function byName(parts: ToolTracePart[], name: string): ToolTracePart | undefined {
  return parts.find((p) => p.toolName === name)
}

describe("buildToolTrace", () => {
  it("returns nothing for a turn that called no tools", () => {
    assert.deepEqual(buildToolTrace([], []), [])
  })

  it("skips a result with no tool name", () => {
    assert.deepEqual(buildToolTrace([{ result: { a: 1 } }], []), [])
  })

  it("emits the same part shape the preview stores", () => {
    const [part] = buildToolTrace([result("mydora_search_availability", { rooms: [] })], [])
    assert.equal(part?.type, "dynamic-tool")
    assert.equal(part?.toolName, "mydora_search_availability")
  })

  it("stops at the part cap", () => {
    const many = Array.from({ length: TOOL_TRACE_MAX_PARTS + 5 }, (_, i) =>
      result(`tool_${i}`)
    )
    assert.equal(buildToolTrace(many, []).length, TOOL_TRACE_MAX_PARTS)
  })
})

describe("search_knowledge", () => {
  const output = {
    passages: [
      { sourceId: "s1", sourceName: "Oda fiyatları", sourceKind: "file", text: "x".repeat(600) },
      { sourceId: "s2", sourceName: "Kahvaltı", text: "y".repeat(600) },
    ],
  }

  it("keeps the source identity the Kaynaklar chip reads", () => {
    const part = byName(buildToolTrace([result("search_knowledge", output)], []), "search_knowledge")
    assert.deepEqual(part?.output, {
      passages: [
        { sourceId: "s1", sourceName: "Oda fiyatları", sourceKind: "file" },
        // sourceKind defaults rather than dropping the passage.
        { sourceId: "s2", sourceName: "Kahvaltı", sourceKind: "text" },
      ],
    })
  })

  it("drops the passage text, which is the bulk of the payload", () => {
    const part = byName(buildToolTrace([result("search_knowledge", output)], []), "search_knowledge")
    const traced = JSON.stringify(part)
    assert.ok(!traced.includes("xxx"), "passage text survived")
    // Measured against the real payload rather than a magic number: two 600-char
    // passages in, source ids out.
    assert.ok(
      traced.length < JSON.stringify(output).length / 5,
      `traced ${traced.length} vs raw ${JSON.stringify(output).length}`
    )
  })

  it("drops passages missing an id or a name", () => {
    const part = byName(
      buildToolTrace(
        [result("search_knowledge", { passages: [{ text: "no ids" }, { sourceId: "s1" }] })],
        []
      ),
      "search_knowledge"
    )
    assert.equal(part?.output, undefined)
  })

  it("survives a search that found nothing", () => {
    const part = byName(
      buildToolTrace([result("search_knowledge", { passages: [] })], []),
      "search_knowledge"
    )
    assert.equal(part?.output, undefined)
    // The tool still ran, so the name is still recorded.
    assert.equal(part?.toolName, "search_knowledge")
  })
})

describe("flag_source_conflict", () => {
  it("keeps both halves — the chip prefers output and falls back to input", () => {
    const args = {
      topic: "Kahvaltı saati",
      conflicts: [
        { sourceId: "s1", value: "07:00", quote: "07:00'de başlar" },
        { sourceId: "s2", value: "08:00", quote: "08:00'de başlar" },
      ],
    }
    const part = byName(
      buildToolTrace([result("flag_source_conflict", { recorded: true, ...args }, args)], []),
      "flag_source_conflict"
    )
    assert.equal((part?.input as { topic?: string })?.topic, "Kahvaltı saati")
    assert.equal((part?.output as { recorded?: boolean })?.recorded, true)
  })
})

describe("every other tool", () => {
  it("keeps the name and drops the output", () => {
    const big = { rooms: Array.from({ length: 50 }, (_, i) => ({ id: i, photos: ["u".repeat(200)] })) }
    const part = byName(
      buildToolTrace([result("mydora_search_availability", big, { nights: 2 })], []),
      "mydora_search_availability"
    )
    assert.equal(part?.output, undefined)
  })

  it("keeps the input as clipped text for debugging", () => {
    const part = byName(
      buildToolTrace([result("mydora_search_availability", {}, { nights: 2 })], []),
      "mydora_search_availability"
    )
    assert.equal(part?.input, '{"nights":2}')
  })

  it("clips an oversized input rather than storing it whole", () => {
    const part = byName(
      buildToolTrace([result("some_tool", {}, { note: "z".repeat(5000) })], []),
      "some_tool"
    )
    const input = part?.input as string
    assert.equal(typeof input, "string")
    assert.ok(input.length <= TOOL_TRACE_INPUT_MAX + 1, `got ${input.length}`)
    assert.ok(input.endsWith("…"))
  })

  it("omits the input entirely when the tool took no arguments", () => {
    const part = byName(buildToolTrace([{ toolName: "some_tool" }], []), "some_tool")
    assert.equal(part?.input, undefined)
  })

  it("resolves the input from toolCalls when the result does not echo it", () => {
    const part = byName(
      buildToolTrace(
        [{ toolName: "send_link_button", toolCallId: "c1" }],
        [{ id: "c1", name: "send_link_button", args: { url: "https://a.com" } }]
      ),
      "send_link_button"
    )
    assert.equal(part?.input, '{"url":"https://a.com"}')
  })
})

describe("size", () => {
  it("keeps a realistic five-tool turn small enough to sit on every message row", () => {
    const trace = buildToolTrace(
      [
        result("update_contact_profile", { ok: true }, { firstName: "Ayşe" }),
        result("search_knowledge", {
          passages: Array.from({ length: 6 }, (_, i) => ({
            sourceId: `s${i}`,
            sourceName: `Kaynak ${i}`,
            sourceKind: "file",
            text: "x".repeat(600),
          })),
        }),
        result("mydora_search_availability", { rooms: Array.from({ length: 30 }, () => ({ photos: ["u".repeat(300)] })) }, { nights: 2 }),
        result("mydora_get_photos", { photos: Array.from({ length: 20 }, () => "u".repeat(300)) }),
        result("send_link_button", { ok: true }, { url: "https://ornek.com/checkout" }),
      ],
      []
    )
    const bytes = JSON.stringify(trace).length
    assert.ok(bytes < 2048, `trace grew to ${bytes} bytes`)
    assert.equal(trace.length, 5)
  })
})
