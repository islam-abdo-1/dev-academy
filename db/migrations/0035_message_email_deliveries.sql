-- ============================================================
-- Dev Academy - Email delivery tracking for staff messages
-- Keeps provider state out of public.messages so recipients can
-- never tamper with delivery flags through the messages RLS
-- update policy. Only staff can read these rows; writes happen
-- through the service-role email endpoint.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_email_deliveries (
    message_id   TEXT PRIMARY KEY
                 REFERENCES public.messages (id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
    provider_id  TEXT,
    error        TEXT,
    attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    sent_at      TIMESTAMPTZ,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_email_deliveries_status_idx
    ON public.message_email_deliveries (status, updated_date DESC);

ALTER TABLE public.message_email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_email_deliveries_select
    ON public.message_email_deliveries;
CREATE POLICY message_email_deliveries_select
    ON public.message_email_deliveries
    FOR SELECT TO authenticated
    USING (public.is_staff());

REVOKE ALL ON TABLE public.message_email_deliveries FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.message_email_deliveries TO authenticated;

COMMENT ON TABLE public.message_email_deliveries IS
    'Resend delivery state per staff message; written by the Pages email endpoint with the service role.';
