-- ============================================================
-- Dev Academy - RLS Policies for Storage Tables
-- سياسات الأمان لجداول التخزين
-- ============================================================

-- ============================================================
-- Cloud Storage Accounts - أدمن فقط (0018)
-- Upload Queue - مستخدم + أدمن (0019)
-- Share Tokens - مستخدم + أدمن، والتحقق عبر RPC فقط (0020)
-- Storage Quota Logs / Daily Upload Stats - أدمن فقط (0021)
-- ============================================================

-- صلاحيات محددة فقط؛ لا GRANT ALL
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_personal_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_queue TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.share_tokens TO authenticated;
GRANT SELECT ON public.cloud_storage_accounts TO authenticated;
GRANT SELECT ON public.storage_quota_logs TO authenticated;
GRANT SELECT ON public.daily_upload_stats TO authenticated;

ALTER TABLE IF EXISTS public.user_saved_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_personal_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.publish_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cloud_storage_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.upload_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.storage_quota_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_upload_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Functions مساعدة للأدمن
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_dead_upload_jobs(
    p_older_than_days INT DEFAULT 30
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INT;
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    IF p_older_than_days IS NULL OR p_older_than_days < 1 THEN
        RAISE EXCEPTION 'p_older_than_days must be >= 1';
    END IF;

    DELETE FROM public.upload_queue
    WHERE status = 'dead_letter'
      AND updated_at < NOW() - make_interval(days => p_older_than_days);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_failed_upload_jobs(
    p_max_retries INT DEFAULT 3
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    retry_count INT;
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    UPDATE public.upload_queue
    SET status = 'pending',
        error = NULL,
        next_retry_at = NOW(),
        retry_count = retry_count + 1
    WHERE status IN ('failed', 'dead_letter')
      AND retry_count < p_max_retries
      AND (next_retry_at IS NULL OR next_retry_at < NOW());

    GET DIAGNOSTICS retry_count = ROW_COUNT;
    RETURN retry_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_storage_stats()
RETURNS TABLE (
    provider TEXT,
    accounts_count INT,
    total_quota_bytes BIGINT,
    used_quota_bytes BIGINT,
    free_quota_bytes BIGINT,
    avg_usage_pct DECIMAL,
    pending_uploads INT,
    processing_uploads INT,
    failed_uploads INT
) LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    RETURN QUERY
    SELECT
        csa.provider,
        COUNT(csa.id)::INT AS accounts_count,
        COALESCE(SUM(csa.total_quota_bytes), 0)::BIGINT AS total_quota_bytes,
        COALESCE(SUM(csa.used_quota_bytes), 0)::BIGINT AS used_quota_bytes,
        COALESCE(SUM(csa.total_quota_bytes - csa.used_quota_bytes), 0)::BIGINT AS free_quota_bytes,
        ROUND(AVG(CASE WHEN csa.total_quota_bytes > 0
            THEN (csa.used_quota_bytes::DECIMAL / csa.total_quota_bytes) * 100
            ELSE 0 END), 2) AS avg_usage_pct,
        COUNT(uq.id) FILTER (WHERE uq.status = 'pending')::INT AS pending_uploads,
        COUNT(uq.id) FILTER (WHERE uq.status = 'processing')::INT AS processing_uploads,
        COUNT(uq.id) FILTER (WHERE uq.status = 'failed')::INT AS failed_uploads
    FROM public.cloud_storage_accounts csa
    LEFT JOIN public.upload_queue uq ON uq.target_account_id = csa.id
    WHERE csa.is_active = TRUE
    GROUP BY csa.provider
    ORDER BY csa.provider;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_dead_upload_jobs(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_upload_jobs(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_stats() TO authenticated;

-- ============================================================
-- Trigger: تحديث إحصائيات اليومية عند تغيير حالة الرفع
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_daily_upload_stats_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status IN ('completed', 'failed') AND OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM public.record_upload_stat(
            NEW.target_provider,
            COALESCE((SELECT file_size FROM public.user_personal_files WHERE id = NEW.file_id), 0),
            NEW.status = 'completed',
            EXTRACT(EPOCH FROM (NEW.updated_at - NEW.created_at)) * 1000
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_daily_upload_stats ON public.upload_queue;
CREATE TRIGGER trigger_update_daily_upload_stats
    AFTER UPDATE ON public.upload_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_daily_upload_stats_on_complete();

-- ============================================================
-- Views: security_invoker حتى تنطبق RLS على المستخدم الحالي
-- ============================================================

CREATE OR REPLACE VIEW public.v_pending_publish_requests
WITH (security_invoker = true) AS
SELECT
    pr.id,
    pr.user_id,
    p.full_name AS user_name,
    p.email AS user_email,
    pr.status,
    pr.items,
    pr.created_at,
    pr.updated_at,
    jsonb_array_length(pr.items) AS items_count
FROM public.publish_requests pr
JOIN public.profiles p ON p.id = pr.user_id
WHERE pr.status IN ('pending', 'needs_changes')
ORDER BY pr.created_at ASC;

CREATE OR REPLACE VIEW public.v_user_personal_files_with_storage
WITH (security_invoker = true) AS
SELECT
    upf.*,
    csa.provider AS storage_provider_name,
    csa.account_email AS storage_account
FROM public.user_personal_files upf
LEFT JOIN public.cloud_storage_accounts csa
    ON upf.storage_provider = csa.provider
    AND csa.is_active = TRUE
ORDER BY upf.created_at DESC;

GRANT SELECT ON public.v_pending_publish_requests TO authenticated;
GRANT SELECT ON public.v_user_personal_files_with_storage TO authenticated;
GRANT SELECT ON public.v_current_storage_quotas TO authenticated;
GRANT SELECT ON public.v_daily_upload_summary TO authenticated;
