-- ============================================================
-- 0008 — tasks ("إيه المطلوب مني")
-- Assignment board: staff publish tasks scoped to a path
-- (major / year / semester / subject / group). Every visitor —
-- anonymous included — can read; only staff can write.
-- ============================================================

create table if not exists public.tasks (
  id            text primary key default gen_random_uuid()::text,
  title         text not null default '',
  details       text default '',
  major         text not null default '',
  year          text not null default '',
  semester      text not null default '',
  subject_name  text not null default '',
  item_type     text not null default '',
  item_name     text not null default '',
  group_name    text not null default '',
  due_date      timestamptz,
  form_url      text default '',
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

create index if not exists tasks_created_idx on public.tasks (created_date desc);
create index if not exists tasks_path_idx on public.tasks (major, year, semester);

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (true);

drop policy if exists tasks_insert_staff on public.tasks;
create policy tasks_insert_staff on public.tasks
  for insert to authenticated with check (public.is_staff());

drop policy if exists tasks_update_staff on public.tasks;
create policy tasks_update_staff on public.tasks
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists tasks_delete_staff on public.tasks;
create policy tasks_delete_staff on public.tasks
  for delete to authenticated using (public.is_staff());

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch
before update on public.tasks
for each row execute function public.touch_updated_date();
