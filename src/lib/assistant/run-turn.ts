import "server-only"

import type { RequestContext } from "@mastra/core/request-context"
import { mastra } from "@/mastra"
import type {
  AssistantRequestContext,
  whatsappAssistant,
} from "@/mastra/agents/whatsapp-assistant"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAssistantClaim } from "@/lib/assistant/claims"
import { loadOrgMcpServerConfigs } from "@/lib/mcp/config"
import { openMcpSession } from "@/lib/mcp/session"
import { describeToolCall } from "@/lib/mcp/toolsets"
import type { McpRuntimeVars, McpServerFailure } from "@/lib/mcp/types"
import { safeJson } from "@/lib/mcp/parse-result"
import { inferClaimKind } from "@/lib/assistant/claim-kind"

/**
 * The single place where MCP tools meet the agent.
 *
 * Both entry points — the WhatsApp webhook and the dashboard preview — run
 * through here so the two paths can never drift apart in which tools, audit or
 * failure handling they get.
 */

type AgentGenerateResult = Awaited<
  ReturnType<typeof whatsappAssistant.generate>
>

export interface AssistantTurnResult {
  result: AgentGenerateResult
  /** Tool names (as the model sees them) contributed by MCP servers this turn. */
  mcpToolNames: Set<string>
  /** Servers that could not be reached — a reason to hand off to a human. */
  mcpFailures: McpServerFailure[]
}

export async function runAssistantTurn(args: {
  orgId: string
  conversationId: string | null
  messages: unknown[]
  requestContext: RequestContext<AssistantRequestContext>
  runtime: Omit<McpRuntimeVars, "orgId">
}): Promise<AssistantTurnResult> {
  const admin = createAdminClient()
  const configs = await loadOrgMcpServerConfigs(admin, args.orgId)

  const session = await openMcpSession(
    configs,
    { orgId: args.orgId, ...args.runtime },
    {
      // Every factual answer sourced from a connected system is auditable —
      // CLAUDE.md's grounding rule, kept alive after the booking tools went away.
      onResult: ({ server, toolName, exposedName, input, value }) => {
        void logAssistantClaim(admin, {
          orgId: args.orgId,
          conversationId: args.conversationId,
          kind: inferClaimKind(value),
          claimText: describeToolCall(exposedName, input, value),
          sourceRef: `mcp:${server.slug}/${toolName}`,
        })
      },
    }
  )

  const mcpToolNames = new Set(
    session.servers.flatMap((server) => server.tools.map((tool) => tool.name))
  )

  try {
    const agent = mastra.getAgent("whatsapp-assistant")
    const result = await agent.generate(args.messages as never, {
      requestContext: args.requestContext,
      toolsets: session.toolsets as never,
    })
    return { result, mcpToolNames, mcpFailures: session.failures }
  } finally {
    await session.close()
  }
}
