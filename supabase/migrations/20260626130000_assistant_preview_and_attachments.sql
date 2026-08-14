-- Apply via Supabase MCP: apply_migration (project aikzddqglqxbybrairwa)

-- Preview sessions
CREATE TABLE IF NOT EXISTS public.assistant_preview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assistant_id uuid NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistant_preview_sessions_assistant_idx
  ON public.assistant_preview_sessions (assistant_id, last_message_at DESC);

-- Preview messages
CREATE TABLE IF NOT EXISTS public.assistant_preview_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.assistant_preview_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  body text NOT NULL DEFAULT '',
  parts jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistant_preview_messages_session_idx
  ON public.assistant_preview_messages (session_id, created_at);

-- Preview attachments
CREATE TABLE IF NOT EXISTS public.assistant_preview_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.assistant_preview_messages(id) ON DELETE SET NULL,
  session_id uuid NOT NULL REFERENCES public.assistant_preview_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image', 'document')),
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  filename text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assistant_preview_attachments_session_idx
  ON public.assistant_preview_attachments (session_id, created_at);

-- RLS
ALTER TABLE public.assistant_preview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_preview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_preview_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_preview_sessions_select ON public.assistant_preview_sessions
  FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY assistant_preview_sessions_insert ON public.assistant_preview_sessions
  FOR INSERT WITH CHECK (public.authorize_for_org(organization_id, 'assistant.access'));

CREATE POLICY assistant_preview_sessions_update ON public.assistant_preview_sessions
  FOR UPDATE USING (public.authorize_for_org(organization_id, 'assistant.access'));

CREATE POLICY assistant_preview_sessions_delete ON public.assistant_preview_sessions
  FOR DELETE USING (public.authorize_for_org(organization_id, 'assistant.access'));

CREATE POLICY assistant_preview_messages_select ON public.assistant_preview_messages
  FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY assistant_preview_messages_insert ON public.assistant_preview_messages
  FOR INSERT WITH CHECK (public.authorize_for_org(organization_id, 'assistant.access'));

CREATE POLICY assistant_preview_attachments_select ON public.assistant_preview_attachments
  FOR SELECT USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY assistant_preview_attachments_insert ON public.assistant_preview_attachments
  FOR INSERT WITH CHECK (public.authorize_for_org(organization_id, 'assistant.access'));

CREATE POLICY assistant_preview_attachments_update ON public.assistant_preview_attachments
  FOR UPDATE USING (public.authorize_for_org(organization_id, 'assistant.access'));

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  20971520,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/epub+zip',
    'text/plain', 'text/html', 'text/markdown'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY chat_attachments_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY chat_attachments_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY chat_attachments_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_user_org_ids())
  );
