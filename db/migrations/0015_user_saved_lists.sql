-- ============================================================
-- Dev Academy - User Saved Lists
-- يسمح للمستخدمين بإنشاء قوائم محفوظة للمواد المفضلة
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_saved_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    -- عمود قديم للتوافق؛ المصدر الرسمي للمشاركة هو share_tokens
    share_token TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- دالة مشتركة للجداول التي تستخدم updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_saved_lists_user_id ON public.user_saved_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_lists_share_token ON public.user_saved_lists(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_saved_lists_is_public ON public.user_saved_lists(is_public) WHERE is_public = TRUE;

DROP TRIGGER IF EXISTS update_user_saved_lists_updated_at ON public.user_saved_lists;
CREATE TRIGGER update_user_saved_lists_updated_at
    BEFORE UPDATE ON public.user_saved_lists
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- عناصر القوائم
-- official_material_id نصي لأن lecture_items/section_items ids نصية.
-- personal_file_id FK يُضاف في 0016 بعد إنشاء الجدول المرجعي.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_saved_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES public.user_saved_lists(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('official', 'personal', 'external')),
    official_material_id TEXT,
    personal_file_id UUID,
    external_url TEXT,
    title TEXT,
    kind TEXT CHECK (kind IN ('lecture', 'section', 'course', 'other')),
    -- لقطة للنطاق (الفرقة/الترم) تُستخدم في روابط المشاركة
    subject_id TEXT,
    year TEXT,
    semester TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    user_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_items_list_id ON public.user_saved_items(list_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_items_official_material_id ON public.user_saved_items(official_material_id) WHERE official_material_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_saved_items_personal_file_id ON public.user_saved_items(personal_file_id) WHERE personal_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_saved_items_scope ON public.user_saved_items(subject_id, year, semester);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_saved_items_has_reference'
    ) THEN
        ALTER TABLE public.user_saved_items
        ADD CONSTRAINT chk_user_saved_items_has_reference
        CHECK (
            official_material_id IS NOT NULL
            OR personal_file_id IS NOT NULL
            OR external_url IS NOT NULL
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_saved_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_saved_lists
    SET updated_at = NOW()
    WHERE id = COALESCE(NEW.list_id, OLD.list_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_saved_list_timestamp ON public.user_saved_items;
CREATE TRIGGER trigger_update_saved_list_timestamp
    AFTER INSERT OR UPDATE OR DELETE ON public.user_saved_items
    FOR EACH ROW EXECUTE FUNCTION public.update_saved_list_timestamp();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.user_saved_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_saved_lists_select_own" ON public.user_saved_lists;
CREATE POLICY "user_saved_lists_select_own" ON public.user_saved_lists
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_lists_insert_own" ON public.user_saved_lists;
CREATE POLICY "user_saved_lists_insert_own" ON public.user_saved_lists
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_lists_update_own" ON public.user_saved_lists;
CREATE POLICY "user_saved_lists_update_own" ON public.user_saved_lists
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_lists_delete_own" ON public.user_saved_lists;
CREATE POLICY "user_saved_lists_delete_own" ON public.user_saved_lists
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_lists_select_public" ON public.user_saved_lists;
CREATE POLICY "user_saved_lists_select_public" ON public.user_saved_lists
    FOR SELECT TO authenticated
    USING (is_public = TRUE OR public.is_staff());

DROP POLICY IF EXISTS "user_saved_items_select_own" ON public.user_saved_items;
CREATE POLICY "user_saved_items_select_own" ON public.user_saved_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_saved_lists l
            WHERE l.id = user_saved_items.list_id
              AND l.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "user_saved_items_insert_own" ON public.user_saved_items;
CREATE POLICY "user_saved_items_insert_own" ON public.user_saved_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_saved_lists l
            WHERE l.id = user_saved_items.list_id
              AND l.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "user_saved_items_update_own" ON public.user_saved_items;
CREATE POLICY "user_saved_items_update_own" ON public.user_saved_items
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_saved_lists l
            WHERE l.id = user_saved_items.list_id
              AND l.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_saved_lists l
            WHERE l.id = user_saved_items.list_id
              AND l.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "user_saved_items_delete_own" ON public.user_saved_items;
CREATE POLICY "user_saved_items_delete_own" ON public.user_saved_items
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_saved_lists l
            WHERE l.id = user_saved_items.list_id
              AND l.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "user_saved_items_select_public" ON public.user_saved_items;
CREATE POLICY "user_saved_items_select_public" ON public.user_saved_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_saved_lists l
            WHERE l.id = user_saved_items.list_id
              AND (l.is_public = TRUE OR public.is_staff())
        )
    );

-- سياسات التوكنات الواسعة القديمة أُزيلت: الوصول العام يتم عبر RPC فقط.
DROP POLICY IF EXISTS "user_saved_lists_select_by_token" ON public.user_saved_lists;
DROP POLICY IF EXISTS "user_saved_items_select_by_token" ON public.user_saved_items;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_items TO authenticated;
