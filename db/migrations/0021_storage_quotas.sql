-- ============================================================
-- Dev Academy - Storage Quotas & Monitoring
-- مراقبة الكوتا والإحصائيات للتخزين السحابي
-- ============================================================

-- جدول سجلات الكوتا (تاريخي)
CREATE TABLE IF NOT EXISTS public.storage_quota_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.cloud_storage_accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('huggingface', 'cloudflare-r2', 'supabase')),
    total_quota_bytes BIGINT,
    used_quota_bytes BIGINT,
    free_quota_bytes BIGINT,
    usage_percentage DECIMAL(5,2), -- نسبة الاستخدام (0-100)
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storage_quota_logs_account_id ON public.storage_quota_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_storage_quota_logs_checked_at ON public.storage_quota_logs(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_quota_logs_provider ON public.storage_quota_logs(provider);

-- جدول إحصائيات الرفع اليومية
CREATE TABLE IF NOT EXISTS public.daily_upload_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    provider TEXT NOT NULL CHECK (provider IN ('huggingface', 'cloudflare-r2', 'supabase')),
    uploads_count INT DEFAULT 0,
    total_bytes BIGINT DEFAULT 0,
    failed_uploads INT DEFAULT 0,
    avg_upload_time_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_upload_stats_date ON public.daily_upload_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_upload_stats_provider ON public.daily_upload_stats(provider);

-- View: ملخص الكوتا الحالية
CREATE OR REPLACE VIEW public.v_current_storage_quotas
WITH (security_invoker = true) AS
SELECT
    csa.id,
    csa.provider,
    csa.account_email,
    csa.total_quota_bytes,
    csa.used_quota_bytes,
    (csa.total_quota_bytes - csa.used_quota_bytes) AS free_quota_bytes,
    CASE
        WHEN csa.total_quota_bytes > 0
        THEN ROUND((csa.used_quota_bytes::DECIMAL / csa.total_quota_bytes) * 100, 2)
        ELSE 0
    END AS usage_percentage,
    csa.is_active,
    csa.last_quota_check,
    csa.priority
FROM public.cloud_storage_accounts csa
WHERE csa.is_active = TRUE
ORDER BY csa.priority ASC, csa.used_quota_bytes ASC;

-- View: إحصائيات الرفع اليومية المجمعة
CREATE OR REPLACE VIEW public.v_daily_upload_summary
WITH (security_invoker = true) AS
SELECT
    date,
    SUM(uploads_count) AS total_uploads,
    SUM(total_bytes) AS total_bytes,
    SUM(failed_uploads) AS total_failed,
    ROUND(AVG(avg_upload_time_ms)::DECIMAL, 2) AS avg_upload_time_ms
FROM public.daily_upload_stats
GROUP BY date
ORDER BY date DESC;

-- Function: تسجيل إحصائيات الرفع اليومية
CREATE OR REPLACE FUNCTION public.record_upload_stat(
    p_provider TEXT,
    p_bytes BIGINT,
    p_success BOOLEAN,
    p_duration_ms INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.daily_upload_stats (date, provider, uploads_count, total_bytes, failed_uploads, avg_upload_time_ms)
    VALUES (CURRENT_DATE, p_provider, 1, COALESCE(p_bytes, 0), CASE WHEN p_success THEN 0 ELSE 1 END, p_duration_ms)
    ON CONFLICT (date, provider) DO UPDATE SET
        uploads_count = daily_upload_stats.uploads_count + 1,
        total_bytes = daily_upload_stats.total_bytes + EXCLUDED.total_bytes,
        failed_uploads = daily_upload_stats.failed_uploads + EXCLUDED.failed_uploads,
        avg_upload_time_ms = CASE
            WHEN daily_upload_stats.uploads_count = 0 THEN EXCLUDED.avg_upload_time_ms
            ELSE ROUND((daily_upload_stats.avg_upload_time_ms * daily_upload_stats.uploads_count + EXCLUDED.avg_upload_time_ms) / (daily_upload_stats.uploads_count + 1))
        END;
END;
$$;

-- Function: تحديث كوتا الحساب
CREATE OR REPLACE FUNCTION public.update_storage_quota(
    p_account_id UUID,
    p_used_bytes BIGINT,
    p_total_bytes BIGINT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.cloud_storage_accounts
    SET
        used_quota_bytes = p_used_bytes,
        total_quota_bytes = COALESCE(p_total_bytes, total_quota_bytes),
        last_quota_check = NOW(),
        updated_at = NOW()
    WHERE id = p_account_id;

    -- تسجيل في السجل التاريخي
    INSERT INTO public.storage_quota_logs (
        account_id, provider, total_quota_bytes, used_quota_bytes,
        free_quota_bytes, usage_percentage
    )
    SELECT
        id, provider, total_quota_bytes, used_quota_bytes,
        COALESCE(total_quota_bytes - used_quota_bytes, 0),
        ROUND((used_quota_bytes::DECIMAL / NULLIF(total_quota_bytes, 0)) * 100, 2)
    FROM public.cloud_storage_accounts
    WHERE id = p_account_id;
END;
$$;

-- RLS Policies
ALTER TABLE public.storage_quota_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_upload_stats ENABLE ROW LEVEL SECURITY;

-- الأدمن فقط يرى السجلات
CREATE POLICY "storage_quota_logs_admin" ON public.storage_quota_logs
    FOR SELECT TO authenticated
    USING (public.is_staff());

CREATE POLICY "daily_upload_stats_admin" ON public.daily_upload_stats
    FOR SELECT TO authenticated
    USING (public.is_staff());

-- Grant permissions
GRANT SELECT ON public.storage_quota_logs TO authenticated;
GRANT SELECT ON public.daily_upload_stats TO authenticated;