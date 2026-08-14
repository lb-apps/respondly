import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  decideHandoff,
  survivedSystemFailure,
  type TurnGroundingSignals,
} from "@/lib/assistant/handoff-decision"

const base: TurnGroundingSignals = {
  knowledgeSearched: false,
  knowledgeFound: false,
  mcpToolCalled: false,
  mcpToolSucceeded: false,
  saidNothing: false,
}

const signals = (over: Partial<TurnGroundingSignals>): TurnGroundingSignals => ({
  ...base,
  ...over,
})

describe("decideHandoff", () => {
  it("keeps a turn the knowledge base answered even though a live system failed", () => {
    // The parcel question: the booking system has nothing to say about it and
    // errored, the knowledge base answered it completely.
    const decision = decideHandoff(
      signals({
        knowledgeSearched: true,
        knowledgeFound: true,
        mcpToolCalled: true,
        mcpToolSucceeded: false,
      })
    )
    assert.equal(decision.handOff, false)
  })

  it("keeps a turn a live system answered even though the knowledge base was empty", () => {
    const decision = decideHandoff(
      signals({
        knowledgeSearched: true,
        knowledgeFound: false,
        mcpToolCalled: true,
        mcpToolSucceeded: true,
      })
    )
    assert.equal(decision.handOff, false)
  })

  it("hands off when every source it consulted came back empty", () => {
    const decision = decideHandoff(
      signals({
        knowledgeSearched: true,
        knowledgeFound: false,
        mcpToolCalled: true,
        mcpToolSucceeded: false,
      })
    )
    assert.equal(decision.handOff, true)
    assert.match(decision.reason, /knowledge empty/)
    assert.match(decision.reason, /systems all failed/)
  })

  it("hands off on an empty knowledge search when no system was involved", () => {
    const decision = decideHandoff(
      signals({ knowledgeSearched: true, knowledgeFound: false })
    )
    assert.equal(decision.handOff, true)
    assert.match(decision.reason, /systems not called/)
  })

  it("leaves greetings and chitchat alone", () => {
    // Nothing was consulted because nothing needed grounding.
    assert.equal(decideHandoff(base).handOff, false)
  })

  it("hands off a silent turn regardless of what the tools did", () => {
    const decision = decideHandoff(
      signals({
        knowledgeSearched: true,
        knowledgeFound: true,
        saidNothing: true,
      })
    )
    assert.equal(decision.handOff, true)
    assert.match(decision.reason, /no reply/)
  })
})

describe("survivedSystemFailure", () => {
  it("flags a failure the reply survived", () => {
    assert.equal(
      survivedSystemFailure({
        ...signals({
          knowledgeSearched: true,
          knowledgeFound: true,
          mcpToolCalled: true,
        }),
        mcpToolFailed: true,
      }),
      true
    )
  })

  it("stays quiet when the turn was handed off anyway", () => {
    assert.equal(
      survivedSystemFailure({
        ...signals({ mcpToolCalled: true }),
        mcpToolFailed: true,
      }),
      false
    )
  })

  it("stays quiet when nothing failed", () => {
    assert.equal(
      survivedSystemFailure({
        ...signals({ mcpToolCalled: true, mcpToolSucceeded: true }),
        mcpToolFailed: false,
      }),
      false
    )
  })
})
