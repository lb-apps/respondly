import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildEngineRules,
  buildIdentityPrompt,
  buildSystemPrompt,
} from "@/mastra/prompt"

/** The sections as the model sees them, in order. */
function joined(config: Parameters<typeof buildSystemPrompt>[0]): string {
  return buildSystemPrompt(config).join("\n\n")
}

const NOW = new Date("2026-08-12T09:00:00Z")

describe("buildSystemPrompt", () => {
  it("leaves WhatsApp's numbers to the tools that enforce them", () => {
    // The limits used to be restated here and in every org's persona, which is
    // how they drifted out of step with the payload builders. The prompt says
    // when to reach for a component; the tool says what fits inside it.
    const prompt = joined({ orgName: "Acme Kuaför", now: NOW })
    const rich = prompt.slice(
      prompt.indexOf("## Rich Content"),
      prompt.indexOf("## Price & Figure Presentation")
    )
    assert.ok(rich.length > 0, "rich content section missing")
    assert.doesNotMatch(rich, /\b(160|1024|4096|256|72)\b/)
    assert.doesNotMatch(rich, /\b2-10\b|\bten rows\b|line breaks/)
  })

  it("writes every instruction in English and marks other languages as samples", () => {
    const prompt = joined({ orgName: "Acme Kuaför", now: NOW })
    assert.match(prompt, /Every instruction you are given is in English/)
    assert.match(prompt, /never an instruction, never a script/)
  })

  it("teaches Turkish by construction, not by banning words", () => {
    const identity = buildIdentityPrompt({ orgName: "Acme Kuaför", now: NOW })
    assert.match(identity, /## Writing Turkish/)
    // The tells that a word blacklist cannot reach.
    assert.match(identity, /Turkish drops the subject/)
    assert.match(identity, /maktadır/)
    assert.match(identity, /No em-dash/)
    assert.match(identity, /Never reuse a knowledge-base or tool sentence word for word/)
  })

  it("shows a whole exchange, not just isolated lines", () => {
    const identity = buildIdentityPrompt({ orgName: "Acme Kuaför", now: NOW })
    assert.match(identity, /One exchange, start to finish/)
    // A second greeting is the habit the transcript exists to kill.
    assert.match(identity, /no second greeting/)
  })

  it("keeps Turkish writing rules out of the shared engine section", () => {
    const engine = buildEngineRules({ orgName: "Acme Kuaför", now: NOW })
    assert.ok(!engine.includes("## Writing Turkish"))
  })

  it("stays industry-agnostic with no persona configured", () => {
    const prompt = joined({ orgName: "Acme Kuaför", now: NOW })
    assert.ok(!/hotel/i.test(prompt), "prompt must not mention hotels")
    assert.ok(!/reseliva/i.test(prompt), "prompt must not mention Reseliva")
    assert.ok(!/check-?in/i.test(prompt), "prompt must not assume stays")
    assert.ok(prompt.includes("Acme Kuaför"))
  })

  it("uses the org persona verbatim when one is set", () => {
    const prompt = joined({
      orgName: "My Dora Hotel",
      persona: "You are a front-desk colleague at My Dora Hotel.",
      now: NOW,
    })
    assert.ok(prompt.includes("You are a front-desk colleague at My Dora Hotel."))
  })

  it("mentions the industry when the org has one", () => {
    const prompt = joined({
      orgName: "Acme",
      industry: "Otelcilik",
      now: NOW,
    })
    assert.ok(prompt.includes("Otelcilik"))
  })

  it("resolves today and tomorrow in the org timezone", () => {
    const prompt = joined({
      orgName: "Acme",
      timezone: "Europe/Istanbul",
      now: NOW,
    })
    assert.ok(prompt.includes("2026-08-12"))
    assert.ok(prompt.includes("2026-08-13"))
  })

  it("tells the model it has no live data when nothing is connected", () => {
    const prompt = joined({ orgName: "Acme", now: NOW })
    assert.ok(prompt.includes("You have no live system connected"))
  })

  it("lists connected MCP tools by their namespaced names", () => {
    const prompt = joined({
      orgName: "Acme",
      now: NOW,
      connectedServers: [
        {
          slug: "mydora",
          name: "My Dora Web Sitesi",
          tools: [
            {
              name: "mydora_search_availability",
              originalName: "search_availability",
              description: "Live rooms and prices for a stay.",
            },
          ],
        },
      ],
    })
    assert.ok(prompt.includes("My Dora Web Sitesi"))
    assert.ok(prompt.includes("mydora_search_availability"))
    assert.ok(prompt.includes("Live rooms and prices for a stay."))
  })

  it("teaches the component rules without leaking WhatsApp limits", () => {
    const prompt = joined({ orgName: "Acme", now: NOW })
    assert.ok(prompt.includes("ask_choice"))
    assert.ok(prompt.includes("request_location"))
    assert.ok(prompt.includes("send_link_button"))
    // The model must not be told to count buttons — the send layer decides.
    assert.ok(!/Maximum 3 buttons/i.test(prompt))
    assert.ok(!prompt.includes("send_quick_reply"))
  })

  it("carries the staff-authored greeting verbatim", () => {
    const prompt = joined({
      orgName: "My Dora Hotel",
      firstMessage: "Merhaba, My Dora Hotel'e hoş geldiniz!",
      now: NOW,
    })
    assert.ok(prompt.includes("Merhaba, My Dora Hotel'e hoş geldiniz!"))
    assert.match(prompt, /send it as written/)
    assert.match(prompt, /do not add an emoji/)
  })

  it("omits the greeting block when no opening line is configured", () => {
    const prompt = joined({ orgName: "Acme", now: NOW })
    assert.ok(!prompt.includes("## Greeting"))
  })

  it("guards both ends of the register, not just the stiff one", () => {
    const prompt = joined({ orgName: "Acme", now: NOW })
    // The old prompt only warned against sounding corporate, so the model
    // drifted the other way — first-name exclamations and greeting emoji.
    assert.match(prompt, /Register: professional, not chummy/)
    assert.match(prompt, /Never in a greeting/)
    assert.match(prompt, /Too casual:/)
    assert.match(prompt, /siz/)
  })

  it("puts identity after the engine rules, so it reads last", () => {
    const sections = buildSystemPrompt({
      orgName: "My Dora Hotel",
      persona: "You are a front-desk colleague at My Dora Hotel.",
      now: NOW,
    })
    assert.equal(sections.length, 2)
    assert.match(sections[0], /^# How This Assistant Works/)
    assert.match(sections[1], /^# Who You Are/)
    assert.ok(sections[1].includes("You are a front-desk colleague at My Dora Hotel."))
  })

  it("keeps voice out of the engine section entirely", () => {
    const engine = buildEngineRules({ orgName: "Acme", now: NOW })
    // Voice belongs to identity alone; two sources of truth is what let the
    // model drift away from the org's persona.
    assert.ok(!engine.includes("Voice Examples"))
    assert.ok(!engine.includes("Register: professional"))
    assert.match(engine, /that section wins/)
  })

  it("tells the model the identity section outranks the rules", () => {
    const identity = buildIdentityPrompt({ orgName: "Acme", now: NOW })
    assert.match(identity, /outranks every general rule above/)
    assert.match(identity, /## Staying in Character/)
  })

  it("forbids composing a specific the tools did not return", () => {
    const engine = buildEngineRules({ orgName: "Acme", now: NOW })
    // The model invented a street address after a location lookup returned
    // only neighbourhood prose.
    assert.match(engine, /Specifics must be verbatim/)
    assert.match(engine, /Never assemble a specific from context/)
    assert.match(engine, /related but different/)
  })

  it("no longer tells the model to paste raw URLs", () => {
    const engine = buildEngineRules({ orgName: "Acme", now: NOW })
    // The format block used to contradict the link-button rule outright.
    assert.ok(!engine.includes("paste the raw URL on its own line"))
    assert.match(engine, /A bare URL in the text is always wrong/)
  })

  it("is stable across calls for the same inputs (prompt caching)", () => {
    const config = { orgName: "Acme", now: NOW }
    assert.deepEqual(buildSystemPrompt(config), buildSystemPrompt(config))
  })
})
