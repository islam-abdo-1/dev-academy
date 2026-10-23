-- ============================================================
-- Share-link expiry defaults and personal-file dedupe
-- ============================================================

ALTER TABLE public.user_personal_files
    DROP CONSTRAINT IF EXISTS user_personal_files_user_hash_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_personal_files_user_hash_key
    ON public.user_personal_files (user_id, sha256_hash)
    WHERE sha256_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_share_token_default_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := NOW() + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_share_token_default_expiry ON public.share_tokens;
CREATE TRIGGER trg_share_token_default_expiry
    BEFORE INSERT ON public.share_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.set_share_token_default_expiry();

REVOKE ALL ON FUNCTION public.set_share_token_default_expiry() FROM PUBLIC, anon, authenticated;

UPDATE public.share_tokens
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_share_link(
    p_resource_type TEXT,
    p_resource_id TEXT,
    p_scope TEXT DEFAULT 'all',
    p_year TEXT DEFAULT NULL,
    p_semester TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_permission TEXT DEFAULT 'view'
) RETURNS TABLE (token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_token TEXT;
    v_expires TIMESTAMPTZ := COALESCE(p_expires_at, NOW() + INTERVAL '30 days');
    v_scope TEXT := COALESCE(p_scope, 'all');
    v_ok BOOLEAN := FALSE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    IF p_resource_type NOT IN (
        'file',
        'list',
        'course',
        'lecture_item',
        'section_item',
        'resource',
        'external'
    ) THEN
        RAISE EXCEPTION 'invalid resource type';
    END IF;

    IF p_resource_id IS NULL OR btrim(p_resource_id) = '' THEN
        RAISE EXCEPTION 'resource id is required';
    END IF;

    IF v_scope NOT IN ('all', 'year', 'term') THEN
        RAISE EXCEPTION 'invalid scope';
    END IF;

    IF p_permission NOT IN ('view', 'download') THEN
        RAISE EXCEPTION 'invalid permission';
    END IF;

    IF p_resource_type = 'file' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_personal_files
            WHERE id::TEXT = p_resource_id AND user_id = v_uid
        ) INTO v_ok;

    ELSIF p_resource_type = 'list' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_saved_lists
            WHERE id::TEXT = p_resource_id AND user_id = v_uid
        ) INTO v_ok;

    ELSIF p_resource_type = 'lecture_item' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.lecture_items
            WHERE id = p_resource_id
        ) INTO v_ok;

    ELSIF p_resource_type = 'section_item' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.section_items
            WHERE id = p_resource_id
        ) INTO v_ok;

    ELSIF p_resource_type = 'resource' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.resources
            WHERE id = p_resource_id
        ) INTO v_ok;

    ELSIF p_resource_type = 'external' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.user_saved_items si
            JOIN public.user_saved_lists l ON l.id = si.list_id
            WHERE si.id::TEXT = p_resource_id
              AND l.user_id = v_uid
              AND si.content_type = 'external'
              AND si.external_url IS NOT NULL
        ) INTO v_ok;

    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.subjects
            WHERE id = p_resource_id
              AND (public.is_staff() OR created_by_id = v_uid::TEXT)
        ) INTO v_ok;
    END IF;

    IF NOT v_ok THEN
        RAISE EXCEPTION 'resource not found or not owned by user';
    END IF;

    IF v_scope IN ('year', 'term') AND (p_year IS NULL OR btrim(p_year) = '') THEN
        RAISE EXCEPTION 'year is required for this scope';
    END IF;

    IF v_scope = 'term' AND (p_semester IS NULL OR btrim(p_semester) = '') THEN
        RAISE EXCEPTION 'semester is required for this scope';
    END IF;

    IF p_resource_type <> 'list' THEN
        v_scope := 'all';
    END IF;

    IF v_expires <= NOW() THEN
        RAISE EXCEPTION 'expiry must be in the future';
    END IF;

    v_token := replace(gen_random_uuid()::TEXT, '-', '');

    INSERT INTO public.share_tokens (
        token, resource_type, resource_id, permission,
        scope, year, semester, expires_at, created_by
    ) VALUES (
        v_token, p_resource_type, p_resource_id, p_permission,
        v_scope,
        CASE WHEN v_scope = 'all' THEN NULL ELSE NULLIF(btrim(p_year), '') END,
        CASE WHEN v_scope = 'term' THEN NULLIF(btrim(p_semester), '') ELSE NULL END,
        v_expires, v_uid
    );

    RETURN QUERY SELECT v_token, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_share_link(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_share_link(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
