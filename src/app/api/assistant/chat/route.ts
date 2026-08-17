import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generatePreviewAssistantReply } from "@/lib/assistant/preview/generate-reply"
import { generateSessionTitleIfMissing } from "@/lib/assistant/preview/title"

export const runtime = "nodejs"
export const maxDuration = 60

/** First text part of an assistant message — the content a title is distilled from. */
function firstText(parts: unknown[]): string {
  for (const p of parts) {
    if (typeof p === "object" && p !== null) {
      const rec = p as Record<string, unknown>
      if (rec.type === "text" && typeof rec.text === "string") return rec.text
    }
  }
  return ""
}

/**
 * Preview chat: non-streaming turn (WhatsApp parity). Rebuilds thread from
 * Supabase, runs agent.generate(), returns one complete assistant message.
 */
export async function POST(req: Request) {
  const body = await req.json()
  const { assistantId, sessionId } = body as {
    assistantId?: string
    sessionId?: string
  }

  if (!assistantId || !sessionId) {
    return new Response("assistantId ve sessionId gerekli", { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response("Yetkisiz", { status: 401 })
  }

  const turn = await generatePreviewAssistantReply(supabase, {
    assistantId,
    sessionId,
  }).catch((err: unknown) => {
    console.error("[assistant/chat]", err)
    const detail = err instanceof Error ? err.message : "Bilinmeyen hata"
    return { error: detail } as const
  })

  if ("error" in turn) {
    return new Response(turn.error, { status: 502 })
  }
  if (!turn.message) {
    return new Response("Yanıt üretilemedi", { status: 502 })
  }

  // Auto-title after the first complete exchange — non-blocking, runs after the response
  // flushes. The helper is idempotent (no-op once a title exists), so firing every turn is safe.
  const assistantText = firstText(turn.message.parts)
  after(async () => {
    try {
      await generateSessionTitleIfMissing(supabase, sessionId, { assistantText })
    } catch {
      // best-effort; title stays null and gets retried next turn / by backfill
    }
  })

  // `events` rides along so the live thread can show what the turn learned about
  // the person without going back to the database for it.
  return Response.json({ message: turn.message, events: turn.events })
}
