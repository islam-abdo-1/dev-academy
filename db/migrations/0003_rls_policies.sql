-- ============================================================
-- Dev Academy - row level security
-- Content read: any active (non-disabled) signed-in user.
-- Content write: staff (admin / super_admin) only.
-- Personal data (favorites, messages, views, logs): scoped to owner.
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.subjects       enable row level security;
alter table public.chapters       enable row level security;
alter table public.lectures       enable row level security;
alter table public.sections       enable row level security;
alter table public.lecture_items  enable row level security;
alter table public.section_items  enable row level security;
alter table public.resources      enable row level security;
alter table public.favorites      enable row level security;
alter table public.subject_views  enable row level security;
alter table public.activity_logs  enable row level security;
alter table public.messages       enable row level security;
alter table public.announcements  enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());

-- inserts happen through the auth trigger (security definer) only
-- deletes: only staff (service_role bypasses RLS anyway)
drop policy if exists profiles_delete_staff on public.profiles;
create policy profiles_delete_staff on public.profiles
  for delete to authenticated
  using (public.is_staff());

-- ---------- content tables: read = active users, write = staff ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'subjects', 'chapters', 'lectures', 'sections', 'lecture_items',
    'section_items', 'resources', 'announcements'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_user())',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert_staff', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_staff())',
      t || '_insert_staff', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update_staff', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())',
      t || '_update_staff', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete_staff', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_staff())',
      t || '_delete_staff', t
    );
  end loop;
end;
$$;

-- ---------- favorites: owners manage their own ----------
drop policy if exists favorites_select on public.favorites;
create policy favorites_select on public.favorites
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists favorites_insert on public.favorites;
create policy favorites_insert on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists favorites_delete on public.favorites;
create policy favorites_delete on public.favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------- subject_views: anyone records own views, staff read all ----------
drop policy if exists subject_views_select on public.subject_views;
create policy subject_views_select on public.subject_views
  for select to authenticated
  using (public.is_staff());

drop policy if exists subject_views_insert on public.subject_views;
create policy subject_views_insert on public.subject_views
  for insert to authenticated
  with check (public.is_active_user() and (user_id is null or user_id = auth.uid()));

drop policy if exists subject_views_delete on public.subject_views;
create policy subject_views_delete on public.subject_views
  for delete to authenticated
  using (public.is_staff());

-- ---------- activity_logs: users append own entries, staff read ----------
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (public.is_staff());

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs
  for insert to authenticated
  with check (public.is_active_user() and performed_by = public.my_email());

drop policy if exists activity_logs_delete on public.activity_logs;
create policy activity_logs_delete on public.activity_logs
  for delete to authenticated
  using (public.is_staff());

-- ---------- messages: own inbox only, staff see everything ----------
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.is_staff()
    or to_email = public.my_email()
    or from_email = public.my_email()
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    public.is_active_user()
    and (public.is_staff() or from_email = public.my_email())
  );

-- recipients may mark as read; staff may edit anything
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (public.is_staff() or to_email = public.my_email())
  with check (public.is_staff() or to_email = public.my_email());

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete to authenticated
  using (public.is_staff());
