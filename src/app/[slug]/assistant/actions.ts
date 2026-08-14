"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { DEFAULT_MODEL } from "@/mastra/openrouter"

const saveSchema = z.object({
  organizationId: z.string().uuid(),
  assistantId: z.string().uuid().nullable(),
  slug: z.string().min(1),
  name: z.string().trim().min(1, "İsim gerekli").max(80),
  tone: z.string().trim().max(80).nullable(),
  systemPrompt: z.string().trim().max(4000).nullable(),
  model: z.string().trim().min(1),
  firstMessage: z.string().trim().max(300).nullable(),
  timezone: z.string().trim().min(1).max(64),
})

export type SaveAssistantInput = z.input<typeof saveSchema>

export type SaveAssistantResult =
  | { ok: true; assistantId: string }
  | { ok: false; error: string }

/**
 * Create or update the org's assistant config. RLS enforces
 * authorize_for_org(organization_id, 'assistant.access') on write — a user
 * without permission gets a DB-level rejection.
 */
export async function saveAssistant(
  input: SaveAssistantInput
): Promise<SaveAssistantResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const v = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const row = {
    organization_id: v.organizationId,
    name: v.name,
    tone: v.tone,
    system_prompt: v.systemPrompt,
    model: v.model || DEFAULT_MODEL,
  }

  if (v.assistantId) {
    // Merge firstMessage into the existing settings JSONB so unrelated keys survive.
    const { data: current } = await supabase
      .from("assistants")
      .select("settings")
      .eq("id", v.assistantId)
      .single()
    const existing =
      current?.settings && typeof current.settings === "object" && !Array.isArray(current.settings)
        ? (current.settings as Record<string, unknown>)
        : {}
    const settings = { ...existing, firstMessage: v.firstMessage, timezone: v.timezone }

    const { error } = await supabase
      .from("assistants")
      .update({ ...row, settings })
      .eq("id", v.assistantId)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/${v.slug}/assistant`)
    return { ok: true, assistantId: v.assistantId }
  }

  const { data, error } = await supabase
    .from("assistants")
    .insert({ ...row, settings: { firstMessage: v.firstMessage, timezone: v.timezone } })
    .select("id")
    .single()
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Kaydedilemedi" }
  }
  revalidatePath(`/${v.slug}/assistant`)
  return { ok: true, assistantId: data.id }
}
