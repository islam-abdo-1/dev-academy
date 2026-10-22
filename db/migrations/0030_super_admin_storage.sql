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
    IF NOT public.is_super_admin() THEN
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
    IF NOT public.is_super_admin() THEN
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

DROP POLICY IF EXISTS "user_storage_usage_read" ON public.user_storage_usage;
CREATE POLICY "user_storage_usage_read" ON public.user_storage_usage
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "storage_objects_read" ON public.storage_objects;
CREATE POLICY "storage_objects_read" ON public.storage_objects
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());
