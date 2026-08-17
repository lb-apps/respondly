"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { CHAT_ATTACHMENTS_BUCKET, CHAT_ATTACHMENT_MAX_BYTES, classifyAttachmentKind } from "@/lib/assistant/attachments/constants"
import { extractAttachmentText } from "@/lib/assistant/attachments/extract"
import { fileExtOf } from "@/lib/knowledge/file-upload"
import {
  createPreviewSession,
  insertPreviewMessage,
} from "@/lib/assistant/preview/store"
import { generateSessionTitleIfMissing } from "@/lib/assistant/preview/title"
import {
  getPreviewThread,
  listPreviewSessions,
  type PreviewThread,
  type PreviewSessionListItem,
} from "@/lib/supabase/queries/preview"

const attachmentSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  storagePath: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  sizeBytes: z.number().int().positive().max(CHAT_ATTACHMENT_MAX_BYTES),
})

export async function createPreviewSessionAction(args: {
  assistantId: string
  organizationId: string
  /** The card this run plays. The session takes its own copy at this moment. */
  personaId: string | null
}): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const sessionId = await createPreviewSession(supabase, {
    organizationId: args.organizationId,
    assistantId: args.assistantId,
    createdBy: user.id,
    personaId: args.personaId,
  })
  if (!sessionId) return { ok: false, error: "Oturum oluşturulamadı" }
  return { ok: true, sessionId }
}

export async function createPreviewAttachmentAction(
  input: z.input<typeof attachmentSchema>
): Promise<
  | {
      ok: true
      id: string
      kind: "image" | "document"
      signedUrl?: string
    }
  | { ok: false; error: string }
> {
  const parsed = attachmentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" }
  }
  const v = parsed.data

  if (!v.storagePath.startsWith(`${v.organizationId}/`)) {
    return { ok: false, error: "Geçersiz dosya yolu" }
  }

  const ext = fileExtOf(v.filename)
  const kind = classifyAttachmentKind(v.mimeType, ext)
  if (!kind) return { ok: false, error: "Desteklenmeyen dosya türü" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  let extracted_text: string | null = null
  if (kind === "document") {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .download(v.storagePath)
    if (dlErr || !blob) {
      return { ok: false, error: "Dosya okunamadı" }
    }
    try {
      const buf = new Uint8Array(await blob.arrayBuffer())
      extracted_text = await extractAttachmentText(buf, ext)
    } catch {
      return { ok: false, error: "Dosyadan metin çıkarılamadı" }
    }
  }

  const { data, error } = await supabase
    .from("assistant_preview_attachments")
    .insert({
      session_id: v.sessionId,
      organization_id: v.organizationId,
      kind,
      storage_path: v.storagePath,
      mime_type: v.mimeType,
      filename: v.filename,
      size_bytes: v.sizeBytes,
      extracted_text,
    })
    .select("id")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "Kaydedilemedi" }

  if (kind === "image") {
    const { data: signed } = await supabase.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .createSignedUrl(v.storagePath, 3600)
    return { ok: true, id: data.id, kind, signedUrl: signed?.signedUrl }
  }

  return { ok: true, id: data.id, kind }
}

export async function getPreviewSessionsAction(
  assistantId: string
): Promise<PreviewSessionListItem[]> {
  return listPreviewSessions(assistantId)
}

export async function getPreviewThreadAction(
  sessionId: string
): Promise<PreviewThread | null> {
  return getPreviewThread(sessionId)
}

export async function savePreviewAssistantMessageAction(args: {
  sessionId: string
  organizationId: string
  role: "user" | "assistant"
  body: string
  parts?: unknown[] | null
  attachmentIds?: string[]
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const messageId = await insertPreviewMessage(supabase, args)
  if (!messageId) return { ok: false, error: "Mesaj kaydedilemedi" }
  return { ok: true, messageId }
}

export async function deletePreviewSessionAction(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: atts } = await supabase
    .from("assistant_preview_attachments")
    .select("storage_path")
    .eq("session_id", sessionId)

  const paths = (atts ?? []).map((a) => a.storage_path)
  if (paths.length > 0) {
    await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).remove(paths)
  }

  const { error } = await supabase
    .from("assistant_preview_sessions")
    .delete()
    .eq("id", sessionId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Backfill a title for an existing session that has none (old data). Generation logic lives in the shared helper. */
export async function generatePreviewSessionTitleAction(
  sessionId: string
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Yetkisiz" }

  const title = await generateSessionTitleIfMissing(supabase, sessionId)
  if (!title) return { ok: false, error: "Başlık üretilemedi" }
  return { ok: true, title }
}
