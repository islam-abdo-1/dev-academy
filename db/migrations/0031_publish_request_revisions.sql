-- ============================================================
-- Allow users to withdraw requests that need changes so they
-- can revise and resubmit the same files.
-- ============================================================

DROP POLICY IF EXISTS "publish_requests_delete_own_pending" ON public.publish_requests;
CREATE POLICY "publish_requests_delete_own_pending" ON public.publish_requests
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() AND status IN ('pending', 'needs_changes'));
