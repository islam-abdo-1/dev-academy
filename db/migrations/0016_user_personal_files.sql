-- ============================================================
-- Dev Academy - User Personal Files
-- ملفات المستخدم الشخصية المرفوعة
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_personal_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    mime_type TEXT,
    storage_provider TEXT NOT NULL CHECK (storage_provider IN ('huggingface', 'cloudflare-r2', 'supabase')),
    storage_path TEXT NOT NULL,
    sha256_hash TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    -- عمود قديم للتوافق؛ المصدر الرسمي للمشاركة هو share_tokens
    share_token TEXT UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_personal_files_user_id ON public.user_personal_files(user_id);
CREATE INDEX IF NOT EXISTS idx_user_personal_files_share_token ON public.user_personal_files(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_personal_files_is_public ON public.user_personal_files(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_personal_files_sha256 ON public.user_personal_files(sha256_hash) WHERE sha256_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_personal_files_storage_provider ON public.user_personal_files(storage_provider);

DROP TRIGGER IF EXISTS update_user_personal_files_updated_at ON public.user_personal_files;
CREATE TRIGGER update_user_personal_files_updated_at
    BEFORE UPDATE ON public.user_personal_files
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK المؤجل من 0015 بعد إنشاء الجدول المرجعي
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_saved_items_personal_file'
    ) THEN
        ALTER TABLE public.user_saved_items
        ADD CONSTRAINT fk_user_saved_items_personal_file
        FOREIGN KEY (personal_file_id)
        REFERENCES public.user_personal_files(id)
        ON DELETE SET NULL;
    END IF;
END;
$$;

ALTER TABLE public.user_personal_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_personal_files_select_own" ON public.user_personal_files;
CREATE POLICY "user_personal_files_select_own" ON public.user_personal_files
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "user_personal_files_insert_own" ON public.user_personal_files;
CREATE POLICY "user_personal_files_insert_own" ON public.user_personal_files
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_personal_files_update_own" ON public.user_personal_files;
CREATE POLICY "user_personal_files_update_own" ON public.user_personal_files
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_personal_files_delete_own" ON public.user_personal_files;
CREATE POLICY "user_personal_files_delete_own" ON public.user_personal_files
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_personal_files_select_public" ON public.user_personal_files;
CREATE POLICY "user_personal_files_select_public" ON public.user_personal_files
    FOR SELECT TO authenticated
    USING (is_public = TRUE OR public.is_staff());

DROP POLICY IF EXISTS "user_personal_files_select_by_token" ON public.user_personal_files;
DROP POLICY IF EXISTS "user_personal_files_admin_all" ON public.user_personal_files;
CREATE POLICY "user_personal_files_admin_all" ON public.user_personal_files
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_personal_files TO authenticated;
