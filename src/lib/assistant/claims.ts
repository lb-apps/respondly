import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type DB = SupabaseClient<Database>

/**
 * Audit log for every factual claim the assistant makes (price, availability,
 * policy). Liability shield — records what was asserted and the source it came
 * from. Best-effort: never throws into the assistant turn.
 */
export async function logAssistantClaim(
  supabase: DB,
  args: {
    orgId: string
    conversationId: string | null
    claimText: string
    kind: "price" | "policy" | "availability"
    sourceRef?: string | null
  }
): Promise<void> {
  try {
    await supabase.from("assistant_claims").insert({
      organization_id: args.orgId,
      conversation_id: args.conversationId,
      claim_text: args.claimText.slice(0, 4000),
      kind: args.kind,
      source_ref: args.sourceRef ?? null,
    })
  } catch {
    // Audit must not break the reply.
  }
}
