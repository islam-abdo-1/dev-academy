-- ============================================================
-- Dev Academy - Material sharing for all displayed content
-- ============================================================

ALTER TABLE public.share_tokens
    DROP CONSTRAINT IF EXISTS share_tokens_resource_type_check;

ALTER TABLE public.share_tokens
    ADD CONSTRAINT share_tokens_resource_type_check
    CHECK (resource_type IN (
        'file',
        'list',
        'course',
        'lecture_item',
        'section_item',
        'resource',
        'external'
    ));

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
    v_expires TIMESTAMPTZ := p_expires_at;
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

    IF v_expires IS NOT NULL AND v_expires <= NOW() THEN
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

CREATE OR REPLACE FUNCTION public.get_shared_list(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    st public.share_tokens%ROWTYPE;
    v_result JSONB;
    v_creator_name TEXT;
    v_creator_avatar TEXT;
BEGIN
    IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
        RETURN NULL;
    END IF;

    SELECT * INTO st
    FROM public.share_tokens
    WHERE token = btrim(p_token);

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF st.expires_at IS NOT NULL AND st.expires_at <= NOW() THEN
        RETURN NULL;
    END IF;

    SELECT
        COALESCE(p.full_name, split_part(p.email, '@', 1), 'مستخدم'),
        p.avatar_url
    INTO v_creator_name, v_creator_avatar
    FROM public.profiles p
    WHERE p.id = st.created_by;

    IF st.resource_type = 'list' THEN
        SELECT jsonb_build_object(
            'resourceType', 'list',
            'resourceId', st.resource_id,
            'title', l.name,
            'description', l.description,
            'items', public._saved_list_items_json(
                l.id, st.scope, st.year, st.semester
            ),
            'permission', st.permission,
            'scope', st.scope,
            'year', st.year,
            'semester', st.semester,
            'expiresAt', st.expires_at,
            'createdAt', st.created_at,
            'createdBy', jsonb_build_object(
                'name', COALESCE(v_creator_name, 'مستخدم'),
                'avatar', v_creator_avatar
            ),
            'allowComments', FALSE,
            'passwordProtected', FALSE
        )
        INTO v_result
        FROM public.user_saved_lists l
        WHERE l.id::TEXT = st.resource_id
          AND l.user_id = st.created_by;

    ELSIF st.resource_type = 'file' THEN
        SELECT jsonb_build_object(
            'resourceType', 'file',
            'resourceId', st.resource_id,
            'title', pf.title,
            'description', pf.description,
            'items', jsonb_build_array(
                jsonb_build_object(
                    'id', pf.id::TEXT,
                    'title', pf.title,
                    'type', 'file',
                    'file_type', pf.file_type,
                    'url', pf.file_url,
                    'file_size', pf.file_size
                )
            ),
            'permission', st.permission,
            'scope', st.scope,
            'year', COALESCE(st.year, pf.metadata->>'year'),
            'semester', COALESCE(st.semester, pf.metadata->>'semester'),
            'expiresAt', st.expires_at,
            'createdAt', st.created_at,
            'createdBy', jsonb_build_object(
                'name', COALESCE(v_creator_name, 'مستخدم'),
                'avatar', v_creator_avatar
            ),
            'allowComments', FALSE,
            'passwordProtected', FALSE
        )
        INTO v_result
        FROM public.user_personal_files pf
        WHERE pf.id::TEXT = st.resource_id
          AND pf.user_id = st.created_by;

    ELSIF st.resource_type = 'lecture_item' THEN
        SELECT jsonb_build_object(
            'resourceType', 'lecture_item',
            'resourceId', st.resource_id,
            'title', li.title,
            'description', li.description,
            'items', jsonb_build_array(
                jsonb_build_object(
                    'id', li.id,
                    'title', li.title,
                    'type', li.type,
                    'file_type', li.file_type,
                    'url', li.url,
                    'file_size', NULL
                )
            ),
            'permission', st.permission,
            'scope', 'all',
            'year', subj.year,
            'semester', subj.semester,
            'expiresAt', st.expires_at,
            'createdAt', st.created_at,
            'createdBy', jsonb_build_object(
                'name', COALESCE(v_creator_name, 'مستخدم'),
                'avatar', v_creator_avatar
            ),
            'allowComments', FALSE,
            'passwordProtected', FALSE
        )
        INTO v_result
        FROM public.lecture_items li
        LEFT JOIN public.subjects subj ON subj.id = li.subject_id
        WHERE li.id = st.resource_id;

    ELSIF st.resource_type = 'section_item' THEN
        SELECT jsonb_build_object(
            'resourceType', 'section_item',
            'resourceId', st.resource_id,
            'title', si.title,
            'description', si.description,
            'items', jsonb_build_array(
                jsonb_build_object(
                    'id', si.id,
                    'title', si.title,
                    'type', si.type,
                    'file_type', si.file_type,
                    'url', si.url,
                    'file_size', NULL
                )
            ),
            'permission', st.permission,
            'scope', 'all',
            'year', subj.year,
            'semester', subj.semester,
            'expiresAt', st.expires_at,
            'createdAt', st.created_at,
            'createdBy', jsonb_build_object(
                'name', COALESCE(v_creator_name, 'مستخدم'),
                'avatar', v_creator_avatar
            ),
            'allowComments', FALSE,
            'passwordProtected', FALSE
        )
        INTO v_result
        FROM public.section_items si
        LEFT JOIN public.subjects subj ON subj.id = si.subject_id
        WHERE si.id = st.resource_id;

    ELSIF st.resource_type = 'resource' THEN
        SELECT jsonb_build_object(
            'resourceType', 'resource',
            'resourceId', st.resource_id,
            'title', r.title,
            'description', r.description,
            'items', jsonb_build_array(
                jsonb_build_object(
                    'id', r.id,
                    'title', r.title,
                    'type', r.type,
                    'file_type', r.type,
                    'url', r.url,
                    'file_size', NULL
                )
            ),
            'permission', st.permission,
            'scope', 'all',
            'year', subj.year,
            'semester', subj.semester,
            'expiresAt', st.expires_at,
            'createdAt', st.created_at,
            'createdBy', jsonb_build_object(
                'name', COALESCE(v_creator_name, 'مستخدم'),
                'avatar', v_creator_avatar
            ),
            'allowComments', FALSE,
            'passwordProtected', FALSE
        )
        INTO v_result
        FROM public.resources r
        LEFT JOIN public.subjects subj ON subj.id = r.subject_id
        WHERE r.id = st.resource_id;

    ELSIF st.resource_type = 'external' THEN
        SELECT jsonb_build_object(
            'resourceType', 'external',
            'resourceId', st.resource_id,
            'title', COALESCE(NULLIF(si.title, ''), si.external_url),
            'description', si.user_notes,
            'items', jsonb_build_array(
                jsonb_build_object(
                    'id', si.id::TEXT,
                    'title', COALESCE(NULLIF(si.title, ''), si.external_url),
                    'type', 'link',
                    'file_type', 'link',
                    'url', si.external_url,
                    'file_size', NULL
                )
            ),
            'permission', st.permission,
            'scope', 'all',
            'year', COALESCE(si.year, subj.year),
            'semester', COALESCE(si.semester, subj.semester),
            'expiresAt', st.expires_at,
            'createdAt', st.created_at,
            'createdBy', jsonb_build_object(
                'name', COALESCE(v_creator_name, 'مستخدم'),
                'avatar', v_creator_avatar
            ),
            'allowComments', FALSE,
            'passwordProtected', FALSE
        )
        INTO v_result
        FROM public.user_saved_items si
        JOIN public.user_saved_lists l ON l.id = si.list_id
        LEFT JOIN public.subjects subj ON subj.id = si.subject_id
        WHERE si.id::TEXT = st.resource_id
          AND l.user_id = st.created_by
          AND si.content_type = 'external';

    ELSIF st.resource_type = 'course' THEN
        SELECT jsonb_build_object(
            'resourceType', 'course',
            'resourceId', st.resource_id,
            'title', subj.name,
            'description', subj.description,
            'items', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', r.id,
                            'title', r.title,
                            'type', r.type,
                            'file_type', r.type,
                            'url', r.url,
                            'file_size', NULL
                        )
                        ORDER BY r.created_date
                    )
                    FROM public.resources r
                    WHERE r.subject_id = subj.id
                ),
                '[]'::JSONB
            ),
            'permission', st.permission,
            'scope', 'all',
            'year', subj.year,
            'semester', subj.semester,
            'expiresAt', st.expires_at,
            'createdAt', st.created_at,
            'createdBy', jsonb_build_object(
                'name', COALESCE(v_creator_name, 'مستخدم'),
                'avatar', v_creator_avatar
            ),
            'allowComments', FALSE,
            'passwordProtected', FALSE
        )
        INTO v_result
        FROM public.subjects subj
        WHERE subj.id = st.resource_id;

    ELSE
        RETURN NULL;
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_list(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_list(TEXT) TO anon, authenticated;
