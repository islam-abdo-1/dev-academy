-- Fix ambiguous retry_count reference in retry_failed_upload_jobs.
-- The local PL/pgSQL variable shared its name with a column in upload_queue.

CREATE OR REPLACE FUNCTION public.retry_failed_upload_jobs(
    p_max_retries INT DEFAULT 3
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_retried INT;
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

    GET DIAGNOSTICS v_retried = ROW_COUNT;
    RETURN v_retried;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_failed_upload_jobs(INT) TO authenticated;
