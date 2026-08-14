import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseMcpToolResult, safeJson } from "@/lib/mcp/parse-result"
import { extractMcpImages } from "@/lib/mcp/images"
import {
  bareToolName,
  isMcpToolError,
  namespaceAndWrapTools,
  namespacedToolName,
} from "@/lib/mcp/toolsets"
import {
  assertSafeMcpUrl,
  buildMcpEndpointUrl,
  displayMcpUrl,
  McpUrlError,
  renderTemplateValues,
} from "@/lib/mcp/url"
import { resolveMcpUrl } from "@/lib/mcp/resolve-url"
import { explainMcpError } from "@/lib/mcp/errors"
import { toolSummariesFromCache } from "@/lib/mcp/tool-cache"
import type { McpServerConfig } from "@/lib/mcp/types"

const config: McpServerConfig = {
  id: "00000000-0000-0000-0000-000000000001",
  organizationId: "00000000-0000-0000-0000-000000000002",
  slug: "mydora",
  name: "My Dora",
  url: "https://example.com/api/mcp",
  transport: "http",
  authKind: "bearer",
  authHeaderName: null,
  secret: "s".repeat(32),
  headers: {},
  queryParams: {},
  timeoutMs: 20000,
}

describe("parseMcpToolResult", () => {
  it("parses JSON out of a single text content block", () => {
    const parsed = parseMcpToolResult({
      content: [{ type: "text", text: '{\n  "rooms": []\n}' }],
    })
    assert.deepEqual(parsed.value, { rooms: [] })
    assert.equal(parsed.isError, false)
  })

  it("keeps prose text as-is", () => {
    const parsed = parseMcpToolResult({
      content: [{ type: "text", text: "Check-in is at 2pm." }],
    })
    assert.equal(parsed.value, "Check-in is at 2pm.")
  })

  it("flags isError and preserves the message", () => {
    const parsed = parseMcpToolResult({
      isError: true,
      content: [{ type: "text", text: "Unknown promo code." }],
    })
    assert.equal(parsed.isError, true)
    assert.equal(parsed.text, "Unknown promo code.")
  })

  it("passes through an already-unwrapped value", () => {
    const parsed = parseMcpToolResult({ rooms: [{ name: "Suite" }] })
    assert.deepEqual(parsed.value, { rooms: [{ name: "Suite" }] })
  })

  it("parses a bare JSON string", () => {
    assert.deepEqual(parseMcpToolResult('{"ok":true}').value, { ok: true })
  })
})

describe("safeJson", () => {
  it("caps long output", () => {
    assert.equal(safeJson("abcdefghij", 4), "abcd…")
  })
})

describe("namespacedToolName", () => {
  it("prefixes with the server slug", () => {
    assert.equal(
      namespacedToolName("mydora", "search_availability"),
      "mydora_search_availability"
    )
  })

  it("sanitizes characters providers reject", () => {
    assert.equal(namespacedToolName("my dora", "get room!"), "my_dora_get_room_")
  })

  it("caps length at 63 characters", () => {
    assert.equal(namespacedToolName("s".repeat(40), "t".repeat(40)).length, 63)
  })
})

describe("bareToolName", () => {
  it("strips a server prefix the client already applied", () => {
    assert.equal(bareToolName("mydora", "mydora_list_rooms"), "list_rooms")
  })

  it("strips a dotted namespace", () => {
    assert.equal(bareToolName("mydora", "mydora.list_rooms"), "list_rooms")
  })

  it("leaves a plain name alone", () => {
    assert.equal(bareToolName("mydora", "list_rooms"), "list_rooms")
  })
})

describe("namespaceAndWrapTools", () => {
  it("namespaces every tool it accepts", () => {
    const { tools, descriptors } = namespaceAndWrapTools(
      { list_rooms: { description: "Rooms", execute: async () => ({}) } },
      { config }
    )
    assert.deepEqual(Object.keys(tools), ["mydora_list_rooms"])
    assert.equal(descriptors[0].originalName, "list_rooms")
  })

  it("refuses to shadow a built-in tool", () => {
    const { tools, rejected } = namespaceAndWrapTools(
      { search_knowledge: { execute: async () => ({}) } },
      { config }
    )
    assert.deepEqual(Object.keys(tools), [])
    assert.deepEqual(rejected, ["search_knowledge"])
  })

  it("turns a thrown tool error into a structured envelope", async () => {
    const { tools } = namespaceAndWrapTools(
      {
        list_rooms: {
          execute: async () => {
            throw new Error("boom")
          },
        },
      },
      { config }
    )
    const tool = tools.mydora_list_rooms as {
      execute: (...args: unknown[]) => Promise<unknown>
    }
    const result = await tool.execute({})
    assert.ok(isMcpToolError(result))
    assert.equal((result as { error: string }).error, "boom")
  })

  it("reports results to the claim hook", async () => {
    const seen: string[] = []
    const { tools } = namespaceAndWrapTools(
      {
        list_rooms: {
          execute: async () => ({
            content: [{ type: "text", text: '{"rooms":[]}' }],
          }),
        },
      },
      { config, onResult: (event) => seen.push(event.exposedName) }
    )
    const tool = tools.mydora_list_rooms as {
      execute: (...args: unknown[]) => Promise<unknown>
    }
    assert.deepEqual(await tool.execute({}), { rooms: [] })
    assert.deepEqual(seen, ["mydora_list_rooms"])
  })

  it("does not call the claim hook for an isError result", async () => {
    let called = false
    const { tools } = namespaceAndWrapTools(
      {
        list_rooms: {
          execute: async () => ({
            isError: true,
            content: [{ type: "text", text: "nope" }],
          }),
        },
      },
      { config, onResult: () => (called = true) }
    )
    const tool = tools.mydora_list_rooms as {
      execute: (...args: unknown[]) => Promise<unknown>
    }
    const result = await tool.execute({})
    assert.ok(isMcpToolError(result))
    assert.equal(called, false)
  })
})

describe("assertSafeMcpUrl", () => {
  it("accepts an https endpoint", () => {
    assert.equal(
      assertSafeMcpUrl("https://example.com/api/mcp"),
      "https://example.com/api/mcp"
    )
  })

  it("rejects a non-http scheme", () => {
    assert.throws(() => assertSafeMcpUrl("file:///etc/passwd"), McpUrlError)
  })

  it("rejects credentials embedded in the URL", () => {
    assert.throws(
      () => assertSafeMcpUrl("https://user:pass@example.com/api/mcp"),
      McpUrlError
    )
  })

  it("rejects garbage", () => {
    assert.throws(() => assertSafeMcpUrl("not a url"), McpUrlError)
  })

  it("assumes https when the address carries no scheme", () => {
    assert.equal(
      assertSafeMcpUrl("www.example.com/api/mcp"),
      "https://www.example.com/api/mcp"
    )
    assert.equal(
      assertSafeMcpUrl("  example.com/api/mcp  "),
      "https://example.com/api/mcp"
    )
  })

  it("keeps an explicit scheme, including one it rejects", () => {
    assert.equal(
      assertSafeMcpUrl("http://localhost:3000/api/mcp"),
      "http://localhost:3000/api/mcp"
    )
    assert.throws(() => assertSafeMcpUrl("ftp://example.com/api/mcp"), McpUrlError)
  })
})

describe("displayMcpUrl", () => {
  it("drops the noise a browser bar drops", () => {
    assert.equal(
      displayMcpUrl("https://www.mydorahotel.com/api/mcp"),
      "mydorahotel.com/api/mcp"
    )
    assert.equal(displayMcpUrl("https://example.com/"), "example.com")
  })

  it("keeps http visible — there the scheme is the point", () => {
    assert.equal(
      displayMcpUrl("http://localhost:3000/api/mcp"),
      "http://localhost:3000/api/mcp"
    )
  })

  it("keeps a host that merely starts with the letters www", () => {
    assert.equal(displayMcpUrl("https://wwwx.example.com/mcp"), "wwwx.example.com/mcp")
  })

  it("passes anything unparseable straight through", () => {
    assert.equal(displayMcpUrl("not a url"), "not a url")
  })
})

describe("resolveMcpUrl", () => {
  /** Minimal fetch double: a map of URL → response. */
  function fakeFetch(routes: Record<string, { status: number; location?: string }>) {
    const seen: string[] = []
    const impl = (async (input: string | URL) => {
      const url = String(input)
      seen.push(url)
      const route = routes[url] ?? { status: 405 }
      return new Response(null, {
        status: route.status,
        headers: route.location ? { location: route.location } : undefined,
      })
    }) as unknown as typeof fetch
    return { impl, seen }
  }

  it("follows an apex → www redirect and reports the move", async () => {
    const { impl } = fakeFetch({
      "https://example.com/api/mcp": {
        status: 308,
        location: "https://www.example.com/api/mcp",
      },
      "https://www.example.com/api/mcp": { status: 401 },
    })

    assert.deepEqual(
      await resolveMcpUrl("example.com/api/mcp", { fetchImpl: impl }),
      { url: "https://www.example.com/api/mcp", redirected: true }
    )
  })

  it("leaves an address that answers directly alone", async () => {
    const { impl } = fakeFetch({ "https://example.com/api/mcp": { status: 405 } })

    assert.deepEqual(
      await resolveMcpUrl("https://example.com/api/mcp", { fetchImpl: impl }),
      { url: "https://example.com/api/mcp", redirected: false }
    )
  })

  it("ignores a redirect that rewrites the path — a login wall, not a move", async () => {
    const { impl } = fakeFetch({
      "https://example.com/api/mcp": { status: 302, location: "/login" },
    })

    assert.deepEqual(
      await resolveMcpUrl("https://example.com/api/mcp", { fetchImpl: impl }),
      { url: "https://example.com/api/mcp", redirected: false }
    )
  })

  it("refuses a redirect into a private address", async () => {
    const { impl } = fakeFetch({
      "https://example.com/api/mcp": {
        status: 307,
        location: "http://169.254.169.254/api/mcp",
      },
    })
    const before = process.env.NODE_ENV
    Object.assign(process.env, { NODE_ENV: "production" })
    try {
      assert.deepEqual(
        await resolveMcpUrl("https://example.com/api/mcp", { fetchImpl: impl }),
        { url: "https://example.com/api/mcp", redirected: false }
      )
    } finally {
      Object.assign(process.env, { NODE_ENV: before })
    }
  })

  it("gives up rather than looping forever", async () => {
    const { impl, seen } = fakeFetch({
      "https://a.example.com/api/mcp": {
        status: 302,
        location: "https://b.example.com/api/mcp",
      },
      "https://b.example.com/api/mcp": {
        status: 302,
        location: "https://a.example.com/api/mcp",
      },
    })

    const result = await resolveMcpUrl("https://a.example.com/api/mcp", {
      fetchImpl: impl,
    })
    assert.ok(seen.length <= 5)
    assert.ok(result.url.endsWith("/api/mcp"))
  })

  it("keeps the typed address when the probe fails", async () => {
    const impl = (async () => {
      throw new Error("fetch failed")
    }) as unknown as typeof fetch

    assert.deepEqual(
      await resolveMcpUrl("https://example.com/api/mcp", { fetchImpl: impl }),
      { url: "https://example.com/api/mcp", redirected: false }
    )
  })
})

describe("buildMcpEndpointUrl", () => {
  it("applies query params with template substitution", () => {
    const url = buildMcpEndpointUrl(
      "https://example.com/api/mcp",
      { promo: "2026", locale: "{{guestLocale}}" },
      { guestLocale: "de" }
    )
    assert.equal(url.searchParams.get("promo"), "2026")
    assert.equal(url.searchParams.get("locale"), "de")
  })

  it("leaves unknown placeholders untouched", () => {
    assert.deepEqual(renderTemplateValues({ a: "{{nope}}" }, {}), {
      a: "{{nope}}",
    })
  })
})

describe("extractMcpImages", () => {
  it("finds images under image-ish keys, and only their URLs", () => {
    const images = extractMcpImages({
      rooms: [
        { name: "Suite", photoUrl: "https://cdn.example.com/suite.jpg" },
        { name: "Twin", imageUrl: "https://cdn.example.com/twin.png" },
      ],
    })
    assert.deepEqual(images, [
      { url: "https://cdn.example.com/suite.jpg" },
      { url: "https://cdn.example.com/twin.png" },
    ])
  })

  it("ignores non-image links", () => {
    assert.deepEqual(
      extractMcpImages({ checkoutUrl: "https://example.com/checkout?token=x" }),
      []
    )
  })

  it("respects the limit", () => {
    const value = {
      images: [
        "https://cdn.example.com/1.jpg",
        "https://cdn.example.com/2.jpg",
        "https://cdn.example.com/3.jpg",
      ],
    }
    assert.equal(extractMcpImages(value, 2).length, 2)
  })
})

describe("toolSummariesFromCache", () => {
  it("skips malformed entries", () => {
    const tools = toolSummariesFromCache([
      { name: "mydora_list_rooms", description: "Rooms" },
      { description: "no name" },
      "nope",
    ] as never)
    assert.equal(tools.length, 1)
    assert.equal(tools[0].name, "mydora_list_rooms")
  })
})

describe("explainMcpError", () => {
  it("recognises a rejected bearer token even without a status code", () => {
    const explained = explainMcpError(
      'Error POSTing to endpoint: {"error":"invalid_token","message":"Invalid bearer token."}'
    )
    assert.match(explained, /Kimlik doğrulama reddedildi/)
  })

  it("strips the stack trace", () => {
    const explained = explainMcpError(
      "Boom happened\n    at StreamableHTTPClientTransport._send (/x/y.js:1:1)"
    )
    assert.equal(explained, "Boom happened")
  })

  it("explains an unreachable endpoint (wrong port)", () => {
    const explained = explainMcpError(
      "Failed to connect to MCP server my_dora: Error: Could not connect to server with any available HTTP transport"
    )
    assert.match(explained, /Adrese ulaşılamadı/)
  })

  it("collapses the repeated wrapper sentences the client emits", () => {
    const explained = explainMcpError("Boom happened\nBoom happened\nBoom happened")
    assert.equal(explained, "Boom happened")
  })

  it("explains a rate limit", () => {
    assert.match(explainMcpError("HTTP 429 Too Many Requests"), /Hız sınırı/)
  })

  it("passes an unrecognised message through", () => {
    assert.equal(explainMcpError("something odd"), "something odd")
  })
})
