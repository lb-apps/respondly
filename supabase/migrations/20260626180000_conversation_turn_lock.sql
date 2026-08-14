-- Per-conversation turn lock (PgBouncer-safe; session advisory locks are not).
-- Used by WhatsApp turn-runner: one active LLM turn per conversation.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS active_turn_message_id uuid,
  ADD COLUMN IF NOT EXISTS active_turn_until timestamptz;

COMMENT ON COLUMN conversations.active_turn_message_id IS
  'Guest message id currently being processed by the bot turn runner.';
COMMENT ON COLUMN conversations.active_turn_until IS
  'Turn lock expiry; stale locks auto-expire after 120s.';

CREATE OR REPLACE FUNCTION public.get_latest_guest_message_id(p_conversation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM messages
  WHERE conversation_id = p_conversation_id
    AND role = 'guest'
  ORDER BY created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.try_claim_conversation_turn(
  p_conversation_id uuid,
  p_trigger_message_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_id uuid;
BEGIN
  SELECT id INTO v_latest_id
  FROM messages
  WHERE conversation_id = p_conversation_id
    AND role = 'guest'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_latest_id IS NULL OR v_latest_id <> p_trigger_message_id THEN
    RETURN false;
  END IF;

  UPDATE conversations
  SET
    active_turn_message_id = p_trigger_message_id,
    active_turn_until = now() + interval '120 seconds'
  WHERE id = p_conversation_id
    AND (
      active_turn_until IS NULL
      OR active_turn_until < now()
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_conversation_turn(
  p_conversation_id uuid,
  p_trigger_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET
    active_turn_message_id = NULL,
    active_turn_until = NULL
  WHERE id = p_conversation_id
    AND active_turn_message_id = p_trigger_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_latest_guest_message_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_claim_conversation_turn(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_conversation_turn(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_latest_guest_message_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_claim_conversation_turn(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_conversation_turn(uuid, uuid) TO service_role;
