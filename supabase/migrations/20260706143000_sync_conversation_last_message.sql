-- Keep conversation list metadata in sync on every message insert (WhatsApp-style
-- bump to top + preview), regardless of which code path inserted the row.

CREATE OR REPLACE FUNCTION public.sync_conversation_last_message_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preview text;
BEGIN
  preview := LEFT(
    COALESCE(
      NULLIF(trim(NEW.body), ''),
      CASE
        WHEN NEW.type = 'media' THEN '📎 Ek'
        ELSE '—'
      END
    ),
    160
  );

  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = preview
  WHERE id = NEW.conversation_id
    AND organization_id = NEW.organization_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_sync_conversation_last_message ON messages;
CREATE TRIGGER messages_sync_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_conversation_last_message_on_insert();
