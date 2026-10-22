-- ============================================================
-- Dev Academy - Upload Queue
-- طابور رفع الملفات للمزودين السحابيين
-- ============================================================

CREATE TABLE IF NOT EXISTS public.upload_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- ربط بالملف الشخصي
    file_id UUID NOT NULL REFERENCES public.user_personal_files(id) ON DELETE CASCADE,
    -- مزود التخزين المستهدف
    target_provider TEXT NOT NULL CHECK (target_provider IN ('huggingface', 'cloudflare-r2', 'supabase')),
    -- الحساب المستهدف
    target_account_id UUID REFERENCES public.cloud_storage_accounts(id) ON DELETE SET NULL,
    -- حالة المهمة
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')) DEFAULT 'pending',
    -- نسبة التقدم (0-100)
    progress INT DEFAULT 0,
    -- رسالة الخطأ (لو فشلت)
    error TEXT,
    -- عدد محاولات إعادة المحاولة
    retry_count INT DEFAULT 0,
    -- وقت المحاولة القادمة
    next_retry_at TIMESTAMPTZ,
    -- معرف الجلسة للرفع المتقطع (chunked upload)
    upload_session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON public.upload_queue(status);
CREATE INDEX IF NOT EXISTS idx_upload_queue_user_id ON public.upload_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_queue_file_id ON public.upload_queue(file_id);
CREATE INDEX IF NOT EXISTS idx_upload_queue_next_retry_at ON public.upload_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_upload_queue_status_created ON public.upload_queue(status, created_at) WHERE status IN ('pending', 'processing');

-- Trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_upload_queue_updated_at ON public.upload_queue;
CREATE TRIGGER update_upload_queue_updated_at
    BEFORE UPDATE ON public.upload_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى مهام رفعه
CREATE POLICY "upload_queue_select_own" ON public.upload_queue
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- النظام ينشئ مهام رفع (via Edge Function)
CREATE POLICY "upload_queue_insert_system" ON public.upload_queue
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- النظام يحدث مهام الرفع (via Edge Function)
CREATE POLICY "upload_queue_update_system" ON public.upload_queue
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- الأدمن يرى جميع المهام
CREATE POLICY "upload_queue_admin_all" ON public.upload_queue
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.upload_queue TO authenticated;