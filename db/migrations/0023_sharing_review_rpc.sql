-- ============================================================
-- Dev Academy - Sharing & Publish Review RPCs
-- المشاركة العامة ومراجعة طلبات النشر
-- ============================================================

-- ------------------------------------------------------------
-- Helper: عناصر قائمة محفوظة بصيغة JSON (بدون فحص ملكية)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._saved_list_items_json(
    p_list_id UUID,
    p_scope TEXT DEFAULT 'all',
    p_year TEXT DEFAULT NULL,
    p_semester TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', x.id,
                'title', x.title,
                'type', x.item_type,
                'file_type', x.file_type,
                'url', x.url,
                'file_size', x.file_size
            )
            ORDER BY x.sort_order, x.created_at
        ),
        '[]'::jsonb
    )
    FROM (
        SELECT
            si.id::TEXT AS id,
            COALESCE(li.title, sci.title, pf.title, si.title, si.external_url, 'عنصر محذوف') AS title,
            COALESCE(
                si.kind,
                CASE
                    WHEN pf.id IS NOT NULL THEN 'file'
                    WHEN si.external_url IS NOT NULL THEN 'link'
                    ELSE 'other'
                END
            ) AS item_type,
            COALESCE(li.file_type, sci.file_type, pf.file_type) AS file_type,
            COALESCE(li.url, sci.url, pf.file_url, si.external_url) AS url,
            pf.file_size,
            si.sort_order,
            si.created_at
        FROM public.user_saved_items si
        LEFT JOIN public.lecture_items li
            ON si.content_type = 'official'
           AND si.kind IS DISTINCT FROM 'section'
           AND li.id = si.official_material_id
        LEFT JOIN public.section_items sci
            ON si.content_type = 'official'
           AND si.kind = 'section'
           AND sci.id = si.official_material_id
        LEFT JOIN public.user_personal_files pf
            ON si.content_type = 'personal'
           AND pf.id = si.personal_file_id
        LEFT JOIN public.subjects subj
            ON subj.id = COALESCE(li.subject_id, sci.subject_id, si.subject_id)
        WHERE si.list_id = p_list_id
          AND (
                p_scope = 'all'
             OR (p_scope = 'year'
                 AND COALESCE(si.year, subj.year, pf.metadata->>'year') = p_year)
             OR (p_scope = 'term'
                 AND COALESCE(si.year, subj.year, pf.metadata->>'year') = p_year
                 AND COALESCE(si.semester, subj.semester, pf.metadata->>'semester') = p_semester)
          )
    ) x;
$$;

REVOKE ALL ON FUNCTION public._saved_list_items_json(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;

-- ------------------------------------------------------------
-- إنشاء رابط مشاركة
-- ------------------------------------------------------------
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
    v_expires TIMESTAMPTZ;
    v_ok BOOLEAN := FALSE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    IF p_resource_type NOT IN ('file', 'list', 'course') THEN
        RAISE EXCEPTION 'invalid resource type';
    END IF;

    IF p_resource_id IS NULL OR btrim(p_resource_id) = '' THEN
        RAISE EXCEPTION 'resource id is required';
    END IF;

    IF p_scope NOT IN ('all', 'year', 'term') THEN
        RAISE EXCEPTION 'invalid scope';
    END IF;

    IF p_scope IN ('year', 'term') AND (p_year IS NULL OR btrim(p_year) = '') THEN
        RAISE EXCEPTION 'year is required for this scope';
    END IF;

    IF p_scope = 'term' AND (p_semester IS NULL OR btrim(p_semester) = '') THEN
        RAISE EXCEPTION 'semester is required for this scope';
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

    v_expires := COALESCE(p_expires_at, NOW() + INTERVAL '30 days');
    IF v_expires <= NOW() THEN
        RAISE EXCEPTION 'expiry must be in the future';
    END IF;

    v_token := replace(gen_random_uuid()::TEXT, '-', '');

    INSERT INTO public.share_tokens (
        token, resource_type, resource_id, permission,
        scope, year, semester, expires_at, created_by
    ) VALUES (
        v_token, p_resource_type, p_resource_id, p_permission,
        p_scope, NULLIF(btrim(p_year), ''), NULLIF(btrim(p_semester), ''),
        v_expires, v_uid
    );

    RETURN QUERY SELECT v_token, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_share_link(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_share_link(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- قراءة مشاركة عامة عبر التوكن (بدون تسجيل دخول)
-- ------------------------------------------------------------
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
        FROM public.user_personal_files pf
        WHERE pf.id::TEXT = st.resource_id
          AND pf.user_id = st.created_by;

    ELSE
        RETURN NULL;
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_list(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_list(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- قراءة عناصر قائمة يملكها المستخدم (أو الأدمن)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_saved_list_items(p_list_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.user_saved_lists
        WHERE id = p_list_id
          AND (user_id = auth.uid() OR public.is_staff())
    ) THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    RETURN public._saved_list_items_json(p_list_id, 'all', NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.get_saved_list_items(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saved_list_items(UUID) TO authenticated;

-- ------------------------------------------------------------
-- مراجعة طلب نشر (أدمن/سوبر أدمن)
-- الموافقة تنشر الملفات الشخصية في الكتالوج تلقائيًا.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_publish_request(
    p_request_id UUID,
    p_action TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r public.publish_requests%ROWTYPE;
    v_action TEXT := lower(btrim(COALESCE(p_action, '')));
    v_item JSONB;
    v_file public.user_personal_files%ROWTYPE;
    v_subject_id TEXT;
    v_chapter_id TEXT;
    v_section_id TEXT;
    v_target_table TEXT;
    v_new_id TEXT;
    v_order INT;
    v_published JSONB := '[]'::JSONB;
    v_reviewer_name TEXT;
    v_file_id UUID;
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    IF v_action NOT IN ('approve', 'approved', 'reject', 'rejected', 'needs_changes', 'changes') THEN
        RAISE EXCEPTION 'invalid action';
    END IF;

    SELECT * INTO r
    FROM public.publish_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'request not found';
    END IF;

    IF r.status NOT IN ('pending', 'needs_changes') THEN
        RAISE EXCEPTION 'request already reviewed';
    END IF;

    SELECT COALESCE(full_name, split_part(email, '@', 1), 'الإدارة')
    INTO v_reviewer_name
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_action IN ('reject', 'rejected', 'needs_changes', 'changes') THEN
        UPDATE public.publish_requests
        SET status = CASE WHEN v_action IN ('reject', 'rejected') THEN 'rejected' ELSE 'needs_changes' END,
            admin_notes = p_notes,
            reviewed_by = auth.uid(),
            reviewed_at = NOW()
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'status', CASE WHEN v_action IN ('reject', 'rejected') THEN 'rejected' ELSE 'needs_changes' END,
            'published_items', '[]'::JSONB
        );
    END IF;

    IF jsonb_typeof(r.items) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'request items must be an array';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(r.items)
    LOOP
        IF v_item->>'type' = 'personal' THEN
            BEGIN
                v_file_id := (v_item->>'id')::UUID;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'invalid personal file id: %', v_item->>'id';
            END;

            SELECT * INTO v_file
            FROM public.user_personal_files
            WHERE id = v_file_id
              AND user_id = r.user_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'personal file % not found for request owner', v_file_id;
            END IF;

            v_subject_id := NULLIF(v_item->>'target_subject_id', '');
            IF v_subject_id IS NULL THEN
                RAISE EXCEPTION 'target_subject_id is required for personal file %', v_file_id;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = v_subject_id) THEN
                RAISE EXCEPTION 'target subject % not found', v_subject_id;
            END IF;

            v_chapter_id := NULLIF(v_item->>'target_chapter_id', '');
            IF v_chapter_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.chapters
                WHERE id = v_chapter_id AND subject_id = v_subject_id
            ) THEN
                RAISE EXCEPTION 'target chapter % not found in subject %', v_chapter_id, v_subject_id;
            END IF;

            v_section_id := NULLIF(v_item->>'target_section_id', '');

            IF v_section_id IS NOT NULL THEN
                SELECT sec.subject_id, sec.chapter_id
                INTO v_subject_id, v_chapter_id
                FROM public.sections sec
                WHERE sec.id = v_section_id
                  AND sec.subject_id = v_subject_id;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'target section % not found in subject %', v_section_id, v_subject_id;
                END IF;

                SELECT COALESCE(MAX("order") + 1, 0) INTO v_order
                FROM public.section_items
                WHERE section_id = v_section_id;

                INSERT INTO public.section_items (
                    subject_id, chapter_id, section_id, title, description,
                    type, file_type, url, "order", created_by_id, created_by, is_sample
                ) VALUES (
                    v_subject_id, v_chapter_id, v_section_id,
                    COALESCE(NULLIF(v_item->>'title', ''), v_file.title),
                    v_file.description,
                    CASE WHEN v_file.mime_type LIKE 'video/%' THEN 'video' ELSE 'file' END,
                    v_file.file_type, v_file.file_url, v_order,
                    auth.uid()::TEXT, v_reviewer_name, FALSE
                )
                RETURNING id INTO v_new_id;

                v_target_table := 'section_items';
            ELSE
                SELECT COALESCE(MAX("order") + 1, 0) INTO v_order
                FROM public.lecture_items
                WHERE subject_id = v_subject_id
                  AND chapter_id IS NOT DISTINCT FROM v_chapter_id;

                INSERT INTO public.lecture_items (
                    subject_id, chapter_id, title, description,
                    type, file_type, url, "order", created_by_id, created_by, is_sample
                ) VALUES (
                    v_subject_id, v_chapter_id,
                    COALESCE(NULLIF(v_item->>'title', ''), v_file.title),
                    v_file.description,
                    CASE WHEN v_file.mime_type LIKE 'video/%' THEN 'video' ELSE 'file' END,
                    v_file.file_type, v_file.file_url, v_order,
                    auth.uid()::TEXT, v_reviewer_name, FALSE
                )
                RETURNING id INTO v_new_id;

                v_target_table := 'lecture_items';
            END IF;

            UPDATE public.user_personal_files
            SET is_public = TRUE
            WHERE id = v_file_id;

            v_published := v_published || jsonb_build_array(
                jsonb_build_object(
                    'source_type', 'personal',
                    'source_id', v_file_id,
                    'target_table', v_target_table,
                    'target_id', v_new_id
                )
            );
        ELSIF v_item->>'type' = 'official' THEN
            v_published := v_published || jsonb_build_array(
                jsonb_build_object(
                    'source_type', 'official',
                    'source_id', v_item->>'id',
                    'target_table', CASE WHEN v_item->>'kind' = 'section' THEN 'section_items' ELSE 'lecture_items' END,
                    'target_id', v_item->>'id'
                )
            );
        ELSE
            RAISE EXCEPTION 'unsupported item type: %', v_item->>'type';
        END IF;
    END LOOP;

    UPDATE public.publish_requests
    SET status = 'approved',
        admin_notes = p_notes,
        published_items = v_published,
        reviewed_by = auth.uid(),
        reviewed_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'status', 'approved',
        'published_items', v_published
    );
END;
$$;

REVOKE ALL ON FUNCTION public.review_publish_request(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_publish_request(UUID, TEXT, TEXT) TO authenticated;
