"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSafeMcpUrl, McpUrlError } from "@/lib/mcp/url"
import { resolveMcpUrl } from "@/lib/mcp/resolve-url"
import { loadMcpServerConfig } from "@/lib/mcp/config"
import { discoverMcpServer } from "@/lib/mcp/discover"
import { toolSummariesToJson } from "@/lib/mcp/tool-cache"
import type { McpToolDescriptor } from "@/lib/mcp/types"
import type { Json } from "@/types/database"
import { rowsToRecord, saveMcpServerSchema } from "./schema"

export type ActionResult =
  | { ok: true; serverId: string }
  | { ok: false; error: string }

export type TestConnectionResult =
  | { ok: true; tools: McpToolDescriptor[]; latencyMs: number }
  | { ok: false; error: string }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * Create or update one MCP server. The secret goes to Vault through a
 * SECURITY DEFINER RPC — it is never stored in a column and never read back
 * into the browser. A blank secret on an existing server keeps the stored one.
 */
export async function saveMcpServer(
  input: z.input<typeof saveMcpServerSchema>
): Promise<ActionResult> {
  const parsed = saveMcpServerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const v = parsed.data

  let url: string
  try {
    url = assertSafeMcpUrl(v.url)
  } catch (err) {
    if (err instanceof McpUrlError) return { ok: false, error: err.message }
    return { ok: false, error: "Adres doğrulanamadı" }
  }

  // Store where the server actually answers. A site redirecting apex → www is
  // the ordinary case, and a redirect at request time either breaks the host
  // pin or strips the auth header — see `resolve-url.ts`.
  url = (await resolveMcpUrl(url)).url

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const row = {
    name: v.name,
    slug: v.slug,
    url,
    transport: v.transport,
    auth_kind: v.authKind,
    auth_header_name: v.authKind === "header" ? (v.authHeaderName ?? "") : null,
    headers: rowsToRecord(v.headers) as Json,
    query_params: rowsToRecord(v.queryParams) as Json,
    timeout_ms: v.timeoutMs,
    enabled: v.enabled,
  }

  let serverId = v.serverId

  if (serverId) {
    const { error } = await supabase
      .from("mcp_servers")
      .update(row)
      .eq("id", serverId)
    if (error) return { ok: false, error: friendlyDbError(error.message) }
  } else {
    const { data, error } = await supabase
      .from("mcp_servers")
      .insert({ ...row, organization_id: v.organizationId })
      .select("id")
      .single()
    if (error || !data) {
      return { ok: false, error: friendlyDbError(error?.message ?? "Sunucu eklenemedi") }
    }
    serverId = data.id
  }

  const secret = v.secret?.trim() ?? ""
  if (v.authKind === "none") {
    const { error } = await supabase.rpc("clear_mcp_server_secret", {
      p_server_id: serverId,
    })
    if (error) return { ok: false, error: error.message }
  } else if (secret) {
    const { error } = await supabase.rpc("set_mcp_server_secret", {
      p_server_id: serverId,
      p_secret: secret,
    })
    if (error) return { ok: false, error: error.message }
  } else {
    // No new secret supplied — there must already be one stored.
    const { data } = await supabase
      .from("mcp_servers")
      .select("auth_secret_id")
      .eq("id", serverId)
      .maybeSingle()
    if (!data?.auth_secret_id) {
      return { ok: false, error: "Gizli anahtar gerekli" }
    }
  }

  revalidatePath(`/${v.slugPath}/mcp`)
  return { ok: true, serverId }
}

const serverActionSchema = z.object({
  serverId: z.string().uuid(),
  slugPath: z.string().min(1),
})

/** Connect once, list the tools, and cache the catalogue on the row. */
export async function testMcpServerConnection(
  input: z.input<typeof serverActionSchema>
): Promise<TestConnectionResult> {
  const parsed = serverActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  // RLS gate: the caller must be able to see the row before we touch it with
  // the service-role client (which needs to read the Vault secret).
  const { data: visible } = await supabase
    .from("mcp_servers")
    .select("id")
    .eq("id", parsed.data.serverId)
    .maybeSingle()
  if (!visible) return { ok: false, error: "Sunucu bulunamadı" }

  const admin = createAdminClient()
  const config = await loadMcpServerConfig(admin, parsed.data.serverId)
  if (!config) return { ok: false, error: "Sunucu bulunamadı" }

  // A redirect can appear long after the address was saved — a deploy adding an
  // apex → www rule is enough. Re-resolving here means testing the connection
  // also repairs the stored address instead of only reporting that it broke.
  const resolved = await resolveMcpUrl(config.url)
  if (resolved.redirected) {
    await supabase
      .from("mcp_servers")
      .update({ url: resolved.url })
      .eq("id", parsed.data.serverId)
  }

  const result = await discoverMcpServer({ ...config, url: resolved.url })

  await supabase
    .from("mcp_servers")
    .update({
      status: result.ok ? "connected" : "error",
      error: result.ok ? null : (result.error ?? "").slice(0, 500),
      tools: result.ok ? toolSummariesToJson(result.tools) : undefined,
      tools_synced_at: result.ok ? new Date().toISOString() : undefined,
    })
    .eq("id", parsed.data.serverId)

  revalidatePath(`/${parsed.data.slugPath}/mcp`)

  return result.ok
    ? { ok: true, tools: result.tools, latencyMs: result.latencyMs }
    : { ok: false, error: result.error ?? "Bağlantı kurulamadı" }
}

export async function setMcpServerEnabled(
  input: z.input<typeof serverActionSchema> & { enabled: boolean }
): Promise<ActionResult> {
  const parsed = serverActionSchema
    .extend({ enabled: z.boolean() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const { error } = await supabase
    .from("mcp_servers")
    .update({ enabled: parsed.data.enabled })
    .eq("id", parsed.data.serverId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/${parsed.data.slugPath}/mcp`)
  return { ok: true, serverId: parsed.data.serverId }
}

export async function deleteMcpServer(
  input: z.input<typeof serverActionSchema>
): Promise<ActionResult> {
  const parsed = serverActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Geçersiz veri" }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  // Drop the Vault secret first — the row is what points at it.
  await supabase.rpc("clear_mcp_server_secret", {
    p_server_id: parsed.data.serverId,
  })

  const { error } = await supabase
    .from("mcp_servers")
    .delete()
    .eq("id", parsed.data.serverId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/${parsed.data.slugPath}/mcp`)
  return { ok: true, serverId: parsed.data.serverId }
}

function friendlyDbError(message: string): string {
  if (message.includes("mcp_servers_org_slug_key")) {
    return "Bu anahtar zaten kullanılıyor. Başka bir anahtar seçin."
  }
  if (message.includes("mcp_servers_slug_format")) {
    return "Anahtar sadece küçük harf, rakam ve alt çizgi içerebilir."
  }
  return message
}
