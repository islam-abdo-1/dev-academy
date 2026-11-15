-- ============================================================
-- Rollback for 0036_shared_subjects.sql
--
-- Use only if the shared-subjects feature must be fully removed
-- before it is used in production. Dropping subject_placements
-- deletes every placement (including shared placements added
-- after the migration) and returns subjects to the legacy
-- single major/year/semester columns, which were never changed
-- by the forward migration.
--
-- Apply with:
--   psql "$DATABASE_URL" -f db/rollback/0036_shared_subjects.rollback.sql
-- or paste the whole file into the Supabase SQL editor.
-- ============================================================

begin;

drop function if exists public.save_subject_with_placements(text, jsonb, jsonb);
drop view if exists public.subject_catalog;
drop table if exists public.subject_placements;

delete from public._app_migrations
where id = '0036_shared_subjects.sql';

commit;
