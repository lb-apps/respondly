-- Inbox list: unread count, read timestamp, pin (additive, zero-downtime)

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

COMMENT ON COLUMN conversations.unread_count IS
  'Shared team unread count; incremented on guest messages via trigger.';
COMMENT ON COLUMN conversations.last_read_at IS
  'When the conversation was last marked read by staff.';
COMMENT ON COLUMN conversations.pinned_at IS
  'When pinned to top of inbox list; NULL = not pinned.';

CREATE INDEX IF NOT EXISTS conversations_org_inbox_list_idx
  ON conversations (organization_id, pinned_at DESC NULLS LAST, last_message_at DESC);

CREATE OR REPLACE FUNCTION public.bump_conversation_unread_on_guest_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'guest' THEN
    UPDATE conversations
    SET unread_count = unread_count + 1
    WHERE id = NEW.conversation_id
      AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_conversation_unread ON messages;
CREATE TRIGGER messages_bump_conversation_unread
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_conversation_unread_on_guest_message();
