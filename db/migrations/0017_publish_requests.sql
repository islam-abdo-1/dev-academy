-- ============================================================
-- Dev Academy - Publish Requests
-- طلبات النشر للأدمن لمراجعة ونشر مواد المستخدمين
-- ============================================================

CREATE TABLE IF NOT EXISTS public.publish_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')) DEFAULT 'pending',
    -- كل عنصر: {type, id, kind, target_subject_id?, target_chapter_id?, title?}
    items JSONB NOT NULL DEFAULT '[]',
    admin_notes TEXT,
    -- العناصر التي أُنشئت فعليًا في الكتالوج عند الموافقة
    published_items JSONB NOT NULL DEFAULT '[]',
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publish_requests_user_id ON public.publish_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_publish_requests_status ON public.publish_requests(status);
CREATE INDEX IF NOT EXISTS idx_publish_requests_created_at ON public.publish_requests(created_at DESC);

DROP TRIGGER IF EXISTS update_publish_requests_updated_at ON public.publish_requests;
CREATE TRIGGER update_publish_requests_updated_at
    BEFORE UPDATE ON public.publish_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.publish_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publish_requests_select_own" ON public.publish_requests;
CREATE POLICY "publish_requests_select_own" ON public.publish_requests
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "publish_requests_insert_own" ON public.publish_requests;
CREATE POLICY "publish_requests_insert_own" ON public.publish_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- المستخدم يلغي طلبه فقط ما دام معلّقًا
DROP POLICY IF EXISTS "publish_requests_delete_own_pending" ON public.publish_requests;
CREATE POLICY "publish_requests_delete_own_pending" ON public.publish_requests
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "publish_requests_admin_all" ON public.publish_requests;
CREATE POLICY "publish_requests_admin_all" ON public.publish_requests
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_requests TO authenticated;
