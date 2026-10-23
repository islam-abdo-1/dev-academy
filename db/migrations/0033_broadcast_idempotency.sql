-- ============================================================
-- Dev Academy - Idempotent staff broadcasts
-- A broadcast batch is identified by a client-generated UUID.
-- Retrying the same batch inserts only recipients that are still
-- missing, so a partial failure can be retried safely.
-- ============================================================

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS broadcast_id UUID,
    ADD COLUMN IF NOT EXISTS broadcast_recipient TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS messages_broadcast_recipient_uidx
    ON public.messages (broadcast_id, broadcast_recipient);

-- Bulk inserts run inside send_broadcast_messages(). The transaction-local
-- flag lets that function record the batch without consuming one rate-limit
-- slot per recipient, while direct message inserts stay rate-limited.
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND COALESCE(current_setting('app.broadcast_batch', TRUE), '') <> 'on' THEN
        PERFORM public.consume_rate_limit(
            'message-send:' || auth.uid()::TEXT,
            30,
            3600
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_broadcast_messages(
    p_broadcast_id UUID,
    p_from_email TEXT,
    p_from_name TEXT,
    p_subject TEXT,
    p_body TEXT,
    p_path TEXT,
    p_recipients TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT := public.my_email();
    v_requested INTEGER := 0;
    v_valid INTEGER := 0;
    v_inserted INTEGER := 0;
BEGIN
    IF v_uid IS NULL OR NOT public.is_active_user() THEN
        RAISE EXCEPTION 'not authenticated or inactive';
    END IF;

    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    IF p_broadcast_id IS NULL THEN
        RAISE EXCEPTION 'broadcast id is required';
    END IF;

    IF v_email IS NULL OR p_from_email IS NULL
       OR lower(btrim(p_from_email)) <> lower(v_email) THEN
        RAISE EXCEPTION 'sender email must match the current user';
    END IF;

    IF p_subject IS NULL OR length(btrim(p_subject)) = 0
       OR length(p_subject) > 200 THEN
        RAISE EXCEPTION 'invalid subject';
    END IF;

    IF p_body IS NULL OR length(btrim(p_body)) = 0
       OR length(p_body) > 5000 THEN
        RAISE EXCEPTION 'invalid body';
    END IF;

    IF p_path IS NOT NULL AND length(p_path) > 120 THEN
        RAISE EXCEPTION 'invalid path';
    END IF;

    IF p_recipients IS NULL OR cardinality(p_recipients) = 0 THEN
        RAISE EXCEPTION 'recipients are required';
    END IF;

    IF cardinality(p_recipients) > 5000 THEN
        RAISE EXCEPTION 'too many recipients';
    END IF;

    SELECT COUNT(*) INTO v_requested
    FROM (
        SELECT DISTINCT lower(btrim(email)) AS email
        FROM unnest(p_recipients) AS email
        WHERE btrim(email) <> ''
    ) recipients;

    IF v_requested = 0 THEN
        RAISE EXCEPTION 'recipients are required';
    END IF;

    SELECT COUNT(*) INTO v_valid
    FROM (
        SELECT DISTINCT lower(btrim(email)) AS email
        FROM unnest(p_recipients) AS email
        WHERE btrim(email) <> ''
    ) recipients
    JOIN public.profiles p ON lower(p.email) = recipients.email
    WHERE p.disabled = FALSE;

    IF v_valid <> v_requested THEN
        RAISE EXCEPTION 'one or more recipients are not active users';
    END IF;

    PERFORM set_config('app.broadcast_batch', 'on', TRUE);

    WITH recipients AS (
        SELECT DISTINCT lower(btrim(email)) AS email
        FROM unnest(p_recipients) AS email
        WHERE btrim(email) <> ''
    ), inserted AS (
        INSERT INTO public.messages (
            to_email,
            from_email,
            from_name,
            subject,
            body,
            read,
            path,
            created_by_id,
            created_by,
            broadcast_id,
            broadcast_recipient
        )
        SELECT
            recipients.email,
            p_from_email,
            NULLIF(btrim(p_from_name), ''),
            p_subject,
            p_body,
            FALSE,
            NULLIF(btrim(p_path), ''),
            v_uid::TEXT,
            p_from_email,
            p_broadcast_id,
            recipients.email
        FROM recipients
        ON CONFLICT (broadcast_id, broadcast_recipient) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM inserted;

    RETURN jsonb_build_object(
        'requested', v_requested,
        'inserted', v_inserted,
        'duplicates', v_requested - v_inserted
    );
END;
$$;

REVOKE ALL ON FUNCTION public.send_broadcast_messages(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_broadcast_messages(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;
