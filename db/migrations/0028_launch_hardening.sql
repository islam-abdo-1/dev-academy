-- ============================================================
-- Dev Academy - Launch hardening
-- Server-side rate limits, service-only storage mutations,
-- and removal of legacy storage table privileges.
-- ============================================================

-- ------------------------------------------------------------
-- Rate limiting
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_key_created
    ON public.rate_limit_events (key, created_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rate_limit_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_key IS NULL OR length(btrim(p_key)) = 0 OR length(p_key) > 200 THEN
        RAISE EXCEPTION 'invalid rate limit key';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 THEN
        RAISE EXCEPTION 'invalid rate limit';
    END IF;
    IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 604800 THEN
        RAISE EXCEPTION 'invalid rate limit window';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('rate:' || p_key, 0));

    DELETE FROM public.rate_limit_events
    WHERE key = p_key
      AND created_at < NOW() - make_interval(secs => p_window_seconds);

    SELECT COUNT(*) INTO v_count
    FROM public.rate_limit_events
    WHERE key = p_key;

    IF v_count >= p_limit THEN
        RAISE EXCEPTION 'rate limit exceeded';
    END IF;

    INSERT INTO public.rate_limit_events (key) VALUES (p_key);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_storage_reservation_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.consume_rate_limit(
        'storage-upload:' || NEW.user_id::TEXT,
        20,
        600
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_storage_reservation_rate_limit ON public.storage_reservations;
CREATE TRIGGER enforce_storage_reservation_rate_limit
    BEFORE INSERT ON public.storage_reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_storage_reservation_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_share_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.created_by IS NOT NULL THEN
        PERFORM public.consume_rate_limit(
            'share-create:' || NEW.created_by::TEXT,
            30,
            3600
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_share_rate_limit ON public.share_tokens;
CREATE TRIGGER enforce_share_rate_limit
    BEFORE INSERT ON public.share_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_share_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_publish_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.consume_rate_limit(
        'publish-request:' || NEW.user_id::TEXT,
        5,
        86400
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_publish_request_rate_limit ON public.publish_requests;
CREATE TRIGGER enforce_publish_request_rate_limit
    BEFORE INSERT ON public.publish_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_publish_request_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        PERFORM public.consume_rate_limit(
            'message-send:' || auth.uid()::TEXT,
            30,
            3600
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_rate_limit ON public.messages;
CREATE TRIGGER enforce_message_rate_limit
    BEFORE INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_message_rate_limit();

-- ------------------------------------------------------------
-- Storage mutations are Worker-only.
-- The Worker verifies the user JWT, then calls these wrappers
-- with the service role and the verified user id.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.service_reserve_storage(
    p_user_id UUID,
    p_bytes BIGINT,
    p_path TEXT,
    p_provider TEXT DEFAULT 'huggingface'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user id is required';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id AND disabled = FALSE
    ) THEN
        RAISE EXCEPTION 'account is not active';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, true);
    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', p_user_id::TEXT, 'role', 'authenticated')::TEXT,
        true
    );

    RETURN public.reserve_storage(p_bytes, p_path, p_provider);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_confirm_storage(
    p_user_id UUID,
    p_reservation_id UUID,
    p_actual_bytes BIGINT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user id is required';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, true);
    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', p_user_id::TEXT, 'role', 'authenticated')::TEXT,
        true
    );

    PERFORM public.confirm_storage(p_reservation_id, p_actual_bytes);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_release_storage(
    p_user_id UUID,
    p_reservation_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user id is required';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, true);
    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', p_user_id::TEXT, 'role', 'authenticated')::TEXT,
        true
    );

    PERFORM public.release_storage(p_reservation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_remove_storage_object(
    p_user_id UUID,
    p_path TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bytes BIGINT;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user id is required';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, true);
    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', p_user_id::TEXT, 'role', 'authenticated')::TEXT,
        true
    );

    v_bytes := public.remove_storage_object(p_path);
    RETURN v_bytes;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_storage(BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_storage(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_storage(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_storage_object(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_storage_reservations() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.service_reserve_storage(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_confirm_storage(UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_release_storage(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_remove_storage_object(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.service_reserve_storage(UUID, BIGINT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_confirm_storage(UUID, UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_release_storage(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_remove_storage_object(UUID, TEXT) TO service_role;

-- ------------------------------------------------------------
-- Legacy storage tables: no browser access.
-- ------------------------------------------------------------

REVOKE ALL ON public.cloud_storage_accounts FROM anon, authenticated;
REVOKE ALL ON public.upload_queue FROM anon, authenticated;
REVOKE ALL ON public.storage_quota_logs FROM anon, authenticated;
REVOKE ALL ON public.daily_upload_stats FROM anon, authenticated;

DROP VIEW IF EXISTS public.v_user_personal_files_with_storage;
REVOKE ALL ON public.v_current_storage_quotas FROM anon, authenticated;
REVOKE ALL ON public.v_daily_upload_summary FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.record_upload_stat(TEXT, BIGINT, BOOLEAN, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_storage_quota(UUID, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_dead_upload_jobs(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retry_failed_upload_jobs(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storage_stats() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cleanup_dead_upload_jobs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_upload_jobs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_stats() TO authenticated;

-- ------------------------------------------------------------
-- URL validation for user-supplied links (new/updated rows).
-- ------------------------------------------------------------

ALTER TABLE public.user_saved_items
    DROP CONSTRAINT IF EXISTS user_saved_items_external_url_http;
ALTER TABLE public.user_saved_items
    ADD CONSTRAINT user_saved_items_external_url_http
    CHECK (
        external_url IS NULL
        OR external_url ~* '^https?://[^[:space:]]+$'
    ) NOT VALID;

ALTER TABLE public.user_personal_files
    DROP CONSTRAINT IF EXISTS user_personal_files_url_http;
ALTER TABLE public.user_personal_files
    ADD CONSTRAINT user_personal_files_url_http
    CHECK (file_url ~* '^https?://[^[:space:]]+$') NOT VALID;

-- Direct token inserts bypass the ownership checks in create_share_link().
REVOKE INSERT, UPDATE ON public.share_tokens FROM anon, authenticated;

-- Do not let a user swap the file behind a pending publish request.
CREATE OR REPLACE FUNCTION public.protect_personal_file_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
        NEW.user_id := OLD.user_id;
        NEW.file_url := OLD.file_url;
        NEW.storage_path := OLD.storage_path;
        NEW.file_type := OLD.file_type;
        NEW.file_size := OLD.file_size;
        NEW.mime_type := OLD.mime_type;
        NEW.sha256_hash := OLD.sha256_hash;
        NEW.storage_provider := OLD.storage_provider;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_personal_file_identity ON public.user_personal_files;
CREATE TRIGGER protect_personal_file_identity
    BEFORE UPDATE ON public.user_personal_files
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_personal_file_identity();

-- Users cannot forge review state when creating a publish request.
CREATE OR REPLACE FUNCTION public.protect_publish_request_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
        NEW.status := 'pending';
        NEW.reviewed_by := NULL;
        NEW.reviewed_at := NULL;
        NEW.admin_notes := NULL;
        NEW.published_items := '[]'::JSONB;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_publish_request_insert ON public.publish_requests;
CREATE TRIGGER protect_publish_request_insert
    BEFORE INSERT ON public.publish_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_publish_request_insert();

CREATE OR REPLACE FUNCTION public.protect_publish_request_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.status IN ('approved', 'rejected')
       AND OLD.status NOT IN ('pending', 'needs_changes') THEN
        RAISE EXCEPTION 'publish request has already been reviewed';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_publish_request_review ON public.publish_requests;
CREATE TRIGGER protect_publish_request_review
    BEFORE UPDATE ON public.publish_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_publish_request_review();

CREATE OR REPLACE FUNCTION public.protect_message_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
        NEW.to_email := OLD.to_email;
        NEW.from_email := OLD.from_email;
        NEW.from_name := OLD.from_name;
        NEW.subject := OLD.subject;
        NEW.body := OLD.body;
        NEW.path := OLD.path;
        NEW.created_date := OLD.created_date;
        NEW.created_by_id := OLD.created_by_id;
        NEW.created_by := OLD.created_by;
        NEW.is_sample := OLD.is_sample;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_message_update ON public.messages;
CREATE TRIGGER protect_message_update
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_message_update();

-- Lists may only expose files owned by the list owner or explicitly public files.
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
        JOIN public.user_saved_lists l
            ON l.id = si.list_id
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
          AND (pf.id IS NULL OR pf.user_id = l.user_id OR pf.is_public = TRUE)
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

REVOKE ALL ON FUNCTION public._saved_list_items_json(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Admin analytics (registered users and daily activity only).
-- Page-view/visitor analytics remain in Cloudflare Web Analytics.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    RETURN jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM public.profiles),
        'active_users', (SELECT COUNT(*) FROM public.profiles WHERE disabled = FALSE),
        'new_users_today', (
            SELECT COUNT(*) FROM public.profiles
            WHERE created_date >= CURRENT_DATE
        ),
        'new_users_7d', (
            SELECT COUNT(*) FROM public.profiles
            WHERE created_date >= NOW() - INTERVAL '7 days'
        ),
        'uploads_today', (
            SELECT COUNT(*) FROM public.user_personal_files
            WHERE created_at >= CURRENT_DATE
        ),
        'messages_today', (
            SELECT COUNT(*) FROM public.messages
            WHERE created_date >= CURRENT_DATE
        ),
        'published_subjects', (SELECT COUNT(*) FROM public.subjects),
        'generated_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;
