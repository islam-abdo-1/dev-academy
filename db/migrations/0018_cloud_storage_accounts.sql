-- ============================================================
-- Dev Academy - Cloud Storage Accounts
-- حسابات التخزين السحابي (Hugging Face, R2, إلخ)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cloud_storage_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- مزود الخدمة
    provider TEXT NOT NULL CHECK (provider IN ('huggingface', 'cloudflare-r2', 'supabase')),
    -- بريد الحساب (للتعرف)
    account_email TEXT,
    -- التوكنات المشفرة (AES-GCM)
    encrypted_tokens BYTEA NOT NULL,
    -- إجمالي الكوتا بالبايت
    total_quota_bytes BIGINT,
    -- الكوتا المستخدمة بالبايت
    used_quota_bytes BIGINT DEFAULT 0,
    -- هل الحساب نشط
    is_active BOOLEAN DEFAULT TRUE,
    -- آخر فحص للكوتا
    last_quota_check TIMESTAMPTZ,
    -- أولوية الاستخدام (الأقل = أولوية أعلى)
    priority INT DEFAULT 1,
    -- ملاحظات
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cloud_storage_accounts_provider ON public.cloud_storage_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_storage_accounts_is_active ON public.cloud_storage_accounts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cloud_storage_accounts_priority ON public.cloud_storage_accounts(priority);

-- Trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_cloud_storage_accounts_updated_at ON public.cloud_storage_accounts;
CREATE TRIGGER update_cloud_storage_accounts_updated_at
    BEFORE UPDATE ON public.cloud_storage_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.cloud_storage_accounts ENABLE ROW LEVEL SECURITY;

-- الأدمن فقط يدير الحسابات
CREATE POLICY "cloud_storage_accounts_admin_all" ON public.cloud_storage_accounts
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_storage_accounts TO authenticated;