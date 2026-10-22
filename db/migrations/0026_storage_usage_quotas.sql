-- ============================================================
-- Dev Academy - Storage quotas, reservations, and object ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS public.storage_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    global_limit_bytes BIGINT NOT NULL DEFAULT 96636764160,
    per_user_limit_bytes BIGINT NOT NULL DEFAULT 838860800,
    monthly_upload_limit_bytes BIGINT NOT NULL DEFAULT 104857600,
    max_file_bytes BIGINT NOT NULL DEFAULT 94371840,
    used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
    reserved_bytes BIGINT NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.storage_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_storage_usage (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
    reserved_bytes BIGINT NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
    month_key TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM'),
    month_uploaded_bytes BIGINT NOT NULL DEFAULT 0 CHECK (month_uploaded_bytes >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.storage_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bytes BIGINT NOT NULL CHECK (bytes > 0),
    provider TEXT NOT NULL DEFAULT 'huggingface',
    object_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'released', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.storage_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    object_path TEXT NOT NULL UNIQUE,
    bytes BIGINT NOT NULL CHECK (bytes > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_reservations_pending
    ON public.storage_reservations(expires_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_storage_reservations_user
    ON public.storage_reservations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_storage_objects_user
    ON public.storage_objects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_usage_used
    ON public.user_storage_usage(used_bytes DESC);

CREATE OR REPLACE FUNCTION public.cleanup_expired_storage_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total BIGINT := 0;
    v_count INTEGER := 0;
BEGIN
    WITH expired AS (
        UPDATE public.storage_reservations
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'pending'
          AND expires_at <= NOW()
        RETURNING user_id, bytes
    ),
    per_user AS (
        SELECT user_id, SUM(bytes)::BIGINT AS bytes
        FROM expired
        GROUP BY user_id
    ),
    usage_update AS (
        UPDATE public.user_storage_usage u
        SET reserved_bytes = GREATEST(0, u.reserved_bytes - per_user.bytes),
            updated_at = NOW()
        FROM per_user
        WHERE u.user_id = per_user.user_id
        RETURNING 1
    )
    SELECT COALESCE(SUM(bytes), 0)::BIGINT, COUNT(*)::INTEGER
    INTO v_total, v_count
    FROM expired;

    UPDATE public.storage_settings
    SET reserved_bytes = GREATEST(0, reserved_bytes - v_total),
        updated_at = NOW()
    WHERE id = 1;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_storage(
    p_bytes BIGINT,
    p_path TEXT,
    p_provider TEXT DEFAULT 'huggingface'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_settings public.storage_settings%ROWTYPE;
    v_usage public.user_storage_usage%ROWTYPE;
    v_id UUID := gen_random_uuid();
    v_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    IF p_bytes IS NULL OR p_bytes <= 0 THEN
        RAISE EXCEPTION 'invalid file size';
    END IF;
    IF p_path IS NULL OR btrim(p_path) = '' THEN
        RAISE EXCEPTION 'invalid object path';
    END IF;
    IF LEFT(btrim(p_path), LENGTH(v_uid::TEXT) + 1) <> v_uid::TEXT || '/' THEN
        RAISE EXCEPTION 'object path must be owned by the user';
    END IF;
    IF p_provider NOT IN ('huggingface', 'supabase') THEN
        RAISE EXCEPTION 'invalid provider';
    END IF;

    PERFORM public.cleanup_expired_storage_reservations();

    SELECT * INTO v_settings
    FROM public.storage_settings
    WHERE id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'storage settings are missing';
    END IF;

    INSERT INTO public.user_storage_usage (user_id)
    VALUES (v_uid)
    ON CONFLICT (user_id) DO UPDATE
    SET month_key = CASE
            WHEN user_storage_usage.month_key = v_month
            THEN user_storage_usage.month_key
            ELSE v_month
        END,
        month_uploaded_bytes = CASE
            WHEN user_storage_usage.month_key = v_month
            THEN user_storage_usage.month_uploaded_bytes
            ELSE 0
        END,
        updated_at = NOW();

    SELECT * INTO v_usage
    FROM public.user_storage_usage
    WHERE user_id = v_uid
    FOR UPDATE;

    IF p_bytes > v_settings.max_file_bytes THEN
        RAISE EXCEPTION 'file exceeds the per-file limit';
    END IF;
    IF v_settings.used_bytes + v_settings.reserved_bytes + p_bytes > v_settings.global_limit_bytes THEN
        RAISE EXCEPTION 'global storage quota exceeded';
    END IF;
    IF v_usage.used_bytes + v_usage.reserved_bytes + p_bytes > v_settings.per_user_limit_bytes THEN
        RAISE EXCEPTION 'user storage quota exceeded';
    END IF;
    IF v_usage.month_uploaded_bytes + p_bytes > v_settings.monthly_upload_limit_bytes THEN
        RAISE EXCEPTION 'monthly upload limit exceeded';
    END IF;

    INSERT INTO public.storage_reservations (
        id, user_id, bytes, provider, object_path, status, expires_at
    ) VALUES (
        v_id, v_uid, p_bytes, p_provider, btrim(p_path), 'pending', NOW() + INTERVAL '20 minutes'
    );

    UPDATE public.storage_settings
    SET reserved_bytes = reserved_bytes + p_bytes,
        updated_at = NOW()
    WHERE id = 1;

    UPDATE public.user_storage_usage
    SET reserved_bytes = reserved_bytes + p_bytes,
        updated_at = NOW()
    WHERE user_id = v_uid;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_storage(
    p_reservation_id UUID,
    p_actual_bytes BIGINT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_reservation public.storage_reservations%ROWTYPE;
    v_settings public.storage_settings%ROWTYPE;
    v_usage public.user_storage_usage%ROWTYPE;
    v_actual BIGINT;
    v_extra BIGINT;
    v_reserved_bytes BIGINT;
    v_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    SELECT * INTO v_reservation
    FROM public.storage_reservations
    WHERE id = p_reservation_id
      AND user_id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'reservation not found';
    END IF;
    IF v_reservation.status NOT IN ('pending', 'expired') THEN
        RAISE EXCEPTION 'reservation is not pending';
    END IF;

    v_reserved_bytes := CASE
        WHEN v_reservation.status = 'pending' THEN v_reservation.bytes
        ELSE 0
    END;

    v_actual := COALESCE(p_actual_bytes, v_reservation.bytes);
    IF v_actual <= 0 THEN
        RAISE EXCEPTION 'invalid actual size';
    END IF;

    SELECT * INTO v_settings
    FROM public.storage_settings
    WHERE id = 1
    FOR UPDATE;

    SELECT * INTO v_usage
    FROM public.user_storage_usage
    WHERE user_id = v_uid
    FOR UPDATE;

    IF v_actual > v_settings.max_file_bytes THEN
        RAISE EXCEPTION 'file exceeds the per-file limit';
    END IF;

    v_extra := GREATEST(0, v_actual - v_reserved_bytes);
    IF v_settings.used_bytes + v_settings.reserved_bytes + v_extra > v_settings.global_limit_bytes THEN
        RAISE EXCEPTION 'global storage quota exceeded';
    END IF;
    IF v_usage.used_bytes + v_usage.reserved_bytes + v_extra > v_settings.per_user_limit_bytes THEN
        RAISE EXCEPTION 'user storage quota exceeded';
    END IF;
    IF v_usage.month_uploaded_bytes + v_actual > v_settings.monthly_upload_limit_bytes THEN
        RAISE EXCEPTION 'monthly upload limit exceeded';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.storage_objects
        WHERE object_path = v_reservation.object_path
    ) THEN
        RAISE EXCEPTION 'object is already registered';
    END IF;

    UPDATE public.storage_settings
    SET reserved_bytes = GREATEST(0, reserved_bytes - v_reserved_bytes),
        used_bytes = used_bytes + v_actual,
        updated_at = NOW()
    WHERE id = 1;

    UPDATE public.user_storage_usage
    SET reserved_bytes = GREATEST(0, reserved_bytes - v_reserved_bytes),
        used_bytes = used_bytes + v_actual,
        month_key = v_month,
        month_uploaded_bytes = CASE
            WHEN month_key = v_month THEN month_uploaded_bytes + v_actual
            ELSE v_actual
        END,
        updated_at = NOW()
    WHERE user_id = v_uid;

    UPDATE public.storage_reservations
    SET status = 'confirmed',
        bytes = v_actual,
        updated_at = NOW()
    WHERE id = v_reservation.id;

    INSERT INTO public.storage_objects (user_id, provider, object_path, bytes)
    VALUES (v_uid, v_reservation.provider, v_reservation.object_path, v_actual);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_storage(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_reservation public.storage_reservations%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    SELECT * INTO v_reservation
    FROM public.storage_reservations
    WHERE id = p_reservation_id
      AND user_id = v_uid
    FOR UPDATE;

    IF NOT FOUND OR v_reservation.status <> 'pending' THEN
        RETURN;
    END IF;

    UPDATE public.storage_reservations
    SET status = 'released', updated_at = NOW()
    WHERE id = v_reservation.id;

    UPDATE public.storage_settings
    SET reserved_bytes = GREATEST(0, reserved_bytes - v_reservation.bytes),
        updated_at = NOW()
    WHERE id = 1;

    UPDATE public.user_storage_usage
    SET reserved_bytes = GREATEST(0, reserved_bytes - v_reservation.bytes),
        updated_at = NOW()
    WHERE user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_storage_object(p_path TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_object public.storage_objects%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    IF p_path IS NULL OR btrim(p_path) = '' THEN
        RETURN 0;
    END IF;

    SELECT * INTO v_object
    FROM public.storage_objects
    WHERE object_path = btrim(p_path)
      AND user_id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    DELETE FROM public.storage_objects WHERE id = v_object.id;

    UPDATE public.storage_settings
    SET used_bytes = GREATEST(0, used_bytes - v_object.bytes),
        updated_at = NOW()
    WHERE id = 1;

    UPDATE public.user_storage_usage
    SET used_bytes = GREATEST(0, used_bytes - v_object.bytes),
        updated_at = NOW()
    WHERE user_id = v_uid;

    RETURN v_object.bytes;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_storage_usage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_settings public.storage_settings%ROWTYPE;
    v_usage public.user_storage_usage%ROWTYPE;
    v_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    PERFORM public.cleanup_expired_storage_reservations();

    INSERT INTO public.user_storage_usage (user_id)
    VALUES (v_uid)
    ON CONFLICT (user_id) DO UPDATE
    SET month_key = CASE
            WHEN user_storage_usage.month_key = v_month
            THEN user_storage_usage.month_key
            ELSE v_month
        END,
        month_uploaded_bytes = CASE
            WHEN user_storage_usage.month_key = v_month
            THEN user_storage_usage.month_uploaded_bytes
            ELSE 0
        END,
        updated_at = NOW();

    SELECT * INTO v_settings FROM public.storage_settings WHERE id = 1;
    SELECT * INTO v_usage FROM public.user_storage_usage WHERE user_id = v_uid;

    RETURN jsonb_build_object(
        'globalUsedBytes', v_settings.used_bytes,
        'globalLimitBytes', v_settings.global_limit_bytes,
        'globalReservedBytes', v_settings.reserved_bytes,
        'userUsedBytes', v_usage.used_bytes,
        'userLimitBytes', v_settings.per_user_limit_bytes,
        'userReservedBytes', v_usage.reserved_bytes,
        'monthlyUploadedBytes', v_usage.month_uploaded_bytes,
        'monthlyLimitBytes', v_settings.monthly_upload_limit_bytes,
        'maxFileBytes', v_settings.max_file_bytes,
        'monthKey', v_usage.month_key
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_storage_admin_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_settings public.storage_settings%ROWTYPE;
    v_top_users JSONB;
    v_users_count INTEGER;
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    PERFORM public.cleanup_expired_storage_reservations();

    SELECT * INTO v_settings FROM public.storage_settings WHERE id = 1;
    SELECT COUNT(*)::INTEGER INTO v_users_count FROM public.user_storage_usage;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB)
    INTO v_top_users
    FROM (
        SELECT
            u.user_id,
            p.full_name,
            u.used_bytes,
            u.reserved_bytes,
            u.month_uploaded_bytes
        FROM public.user_storage_usage u
        JOIN public.profiles p ON p.id = u.user_id
        ORDER BY u.used_bytes DESC
        LIMIT 10
    ) t;

    RETURN jsonb_build_object(
        'globalUsedBytes', v_settings.used_bytes,
        'globalLimitBytes', v_settings.global_limit_bytes,
        'globalReservedBytes', v_settings.reserved_bytes,
        'perUserLimitBytes', v_settings.per_user_limit_bytes,
        'monthlyLimitBytes', v_settings.monthly_upload_limit_bytes,
        'maxFileBytes', v_settings.max_file_bytes,
        'usersCount', v_users_count,
        'topUsers', v_top_users
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_storage_settings(
    p_global_limit_bytes BIGINT DEFAULT NULL,
    p_per_user_limit_bytes BIGINT DEFAULT NULL,
    p_monthly_limit_bytes BIGINT DEFAULT NULL,
    p_max_file_bytes BIGINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    UPDATE public.storage_settings
    SET global_limit_bytes = COALESCE(p_global_limit_bytes, global_limit_bytes),
        per_user_limit_bytes = COALESCE(p_per_user_limit_bytes, per_user_limit_bytes),
        monthly_upload_limit_bytes = COALESCE(p_monthly_limit_bytes, monthly_upload_limit_bytes),
        max_file_bytes = COALESCE(p_max_file_bytes, max_file_bytes),
        updated_by = auth.uid(),
        updated_at = NOW()
    WHERE id = 1;

    RETURN public.get_storage_admin_summary();
END;
$$;

ALTER TABLE public.storage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage_settings_read" ON public.storage_settings;
CREATE POLICY "storage_settings_read" ON public.storage_settings
    FOR SELECT TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "user_storage_usage_read" ON public.user_storage_usage;
CREATE POLICY "user_storage_usage_read" ON public.user_storage_usage
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "storage_objects_read" ON public.storage_objects;
CREATE POLICY "storage_objects_read" ON public.storage_objects
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_staff());

REVOKE ALL ON public.storage_settings FROM anon, authenticated;
REVOKE ALL ON public.user_storage_usage FROM anon, authenticated;
REVOKE ALL ON public.storage_reservations FROM anon, authenticated;
REVOKE ALL ON public.storage_objects FROM anon, authenticated;

GRANT SELECT ON public.storage_settings TO authenticated;
GRANT SELECT ON public.user_storage_usage TO authenticated;
GRANT SELECT ON public.storage_objects TO authenticated;

REVOKE ALL ON FUNCTION public.cleanup_expired_storage_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_storage(BIGINT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_storage(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_storage(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_storage_object(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storage_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storage_admin_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_storage_settings(BIGINT, BIGINT, BIGINT, BIGINT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_storage_reservations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_storage(BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_storage(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_storage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_storage_object(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_admin_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_storage_settings(BIGINT, BIGINT, BIGINT, BIGINT) TO authenticated;
