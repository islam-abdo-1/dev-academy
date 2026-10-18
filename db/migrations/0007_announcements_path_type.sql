-- ============================================================
-- 0007 — announcement targeting fields
-- The broadcast panel already lets staff pick a notice type and
-- a target path (major / year) but the columns were missing so
-- both values were silently dropped on insert.
-- ============================================================

alter table public.announcements add column if not exists path text;
alter table public.announcements add column if not exists type text not null default 'info';
