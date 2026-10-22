-- ============================================================
-- Dev Academy - remove email-derived display names from public RPCs
-- ============================================================

DO $$
DECLARE
    v_definition TEXT;
    v_old TEXT;
    v_new TEXT;
BEGIN
    SELECT pg_get_functiondef('public.get_shared_list(text)'::regprocedure)
    INTO v_definition;

    v_old := 'COALESCE(p.full_name, split_part(p.email, ''@'', 1), ''مستخدم'')';
    v_new := 'COALESCE(NULLIF(btrim(p.full_name), ''''), ''مستخدم'')';

    IF POSITION(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION 'get_shared_list does not contain the expected email fallback';
    END IF;

    EXECUTE REPLACE(v_definition, v_old, v_new);
END;
$$;

DO $$
DECLARE
    v_definition TEXT;
    v_old TEXT;
    v_new TEXT;
BEGIN
    IF to_regprocedure('public.review_publish_request(uuid,text,text)') IS NULL THEN
        RETURN;
    END IF;

    SELECT pg_get_functiondef('public.review_publish_request(uuid,text,text)'::regprocedure)
    INTO v_definition;

    v_old := 'COALESCE(full_name, split_part(email, ''@'', 1), ''الإدارة'')';
    v_new := 'COALESCE(NULLIF(btrim(full_name), ''''), ''الإدارة'')';

    IF POSITION(v_old IN v_definition) = 0 THEN
        RETURN;
    END IF;

    EXECUTE REPLACE(v_definition, v_old, v_new);
END;
$$;

REVOKE ALL ON public.v_pending_publish_requests FROM anon;
GRANT SELECT ON public.v_pending_publish_requests TO authenticated;
