-- ============================================================
-- Dev Academy - Share Tokens
-- توكنات المشاركة العامة للملفات والقوائم
-- resource_id نصي لأن معرفات الكتالوج/المواد نصية.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.share_tokens (
    token TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'list', 'course')),
    resource_id TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'download')) DEFAULT 'view',
    scope TEXT NOT NULL CHECK (scope IN ('all', 'year', 'term')) DEFAULT 'all',
    year TEXT,
    semester TEXT,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (scope <> 'year' OR year IS NOT NULL),
    CHECK (scope <> 'term' OR (year IS NOT NULL AND semester IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_resource ON public.share_tokens(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_created_by ON public.share_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at ON public.share_tokens(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "share_tokens_select_own" ON public.share_tokens;
CREATE POLICY "share_tokens_select_own" ON public.share_tokens
    FOR SELECT TO authenticated
    USING (created_by = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "share_tokens_insert_own" ON public.share_tokens;
CREATE POLICY "share_tokens_insert_own" ON public.share_tokens
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "share_tokens_delete_own" ON public.share_tokens;
CREATE POLICY "share_tokens_delete_own" ON public.share_tokens
    FOR DELETE TO authenticated
    USING (created_by = auth.uid() OR public.is_staff());

-- لا توجد سياسة قراءة عامة: التحقق يتم عبر get_shared_list() فقط.
DROP POLICY IF EXISTS "share_tokens_select_any" ON public.share_tokens;

DROP POLICY IF EXISTS "share_tokens_admin_all" ON public.share_tokens;
CREATE POLICY "share_tokens_admin_all" ON public.share_tokens
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

GRANT SELECT, INSERT, DELETE ON public.share_tokens TO authenticated;
