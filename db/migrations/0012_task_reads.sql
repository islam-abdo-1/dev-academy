-- ============================================================
-- 0012 — task read state on the server
-- "تمت المشاهدة" for tasks used to live in localStorage, so a
-- user opening the site from another device saw every task as
-- unseen again. Store it per profile instead.
-- ============================================================

create table if not exists public.task_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_id    text not null,
  seen_at    timestamptz not null default now(),
  primary key (profile_id, task_id)
);

alter table public.task_reads enable row level security;

drop policy if exists task_reads_select_own on public.task_reads;
create policy task_reads_select_own on public.task_reads
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists task_reads_insert_own on public.task_reads;
create policy task_reads_insert_own on public.task_reads
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists task_reads_delete_own on public.task_reads;
create policy task_reads_delete_own on public.task_reads
  for delete to authenticated using (profile_id = auth.uid());
