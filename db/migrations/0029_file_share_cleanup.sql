CREATE OR REPLACE FUNCTION public.cleanup_file_share_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.share_tokens
    WHERE resource_type = 'file'
      AND resource_id = OLD.id::TEXT;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_file_share_tokens ON public.user_personal_files;
CREATE TRIGGER trg_cleanup_file_share_tokens
    AFTER DELETE ON public.user_personal_files
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_file_share_tokens();

DELETE FROM public.share_tokens st
WHERE st.resource_type = 'file'
  AND NOT EXISTS (
      SELECT 1
      FROM public.user_personal_files f
      WHERE f.id::TEXT = st.resource_id
  );

UPDATE public.share_tokens
SET expires_at = NULL
WHERE expires_at IS NOT NULL;

REVOKE ALL ON FUNCTION public.cleanup_file_share_tokens() FROM PUBLIC, anon, authenticated;
