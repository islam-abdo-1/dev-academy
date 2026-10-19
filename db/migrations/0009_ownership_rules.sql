-- ============================================================
-- 0009 — ownership-based control (messages / announcements / tasks)
--
-- Rules:
--   * any staff member (admin or super_admin) can CREATE messages,
--     announcements and tasks.
--   * a regular admin may only UPDATE / DELETE items they own
--     (messages: from_email = me, announcements/tasks: created_by = me).
--   * super_admin controls everything.
--   * recipients may still mark their own inbox messages as read;
--     a guard trigger locks every other field for non-senders.
--   * role / disabled / email / legacy_id on profiles can only be
--     changed by super_admin (closes self-promotion hole).
--   * profile rows can only be updated by their owner or super_admin,
--     and deleted by super_admin only.
-- ============================================================

-- ---------- 1) messages: sender owns, super controls all ----------

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (
    public.is_super_admin()
    or from_email = public.my_email()
    or to_email = public.my_email()
  )
  with check (
    public.is_super_admin()
    or from_email = public.my_email()
    or to_email = public.my_email()
  );

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete to authenticated
  using (public.is_super_admin() or from_email = public.my_email());

-- non-sender / non-super can only toggle "read" — content stays frozen
create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_read boolean := new.read;
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_super_admin() or old.from_email = public.my_email() then
    return new;
  end if;
  new := old;
  new.read := v_read;
  return new;
end;
$$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
before update on public.messages
for each row execute function public.guard_message_update();

-- ---------- 2) announcements: creator owns, super controls all ----------

drop policy if exists announcements_update_staff on public.announcements;
drop policy if exists announcements_update_own on public.announcements;
create policy announcements_update_own on public.announcements
  for update to authenticated
  using (public.is_super_admin() or created_by = public.my_email())
  with check (public.is_super_admin() or created_by = public.my_email());

drop policy if exists announcements_delete_staff on public.announcements;
drop policy if exists announcements_delete_own on public.announcements;
create policy announcements_delete_own on public.announcements
  for delete to authenticated
  using (public.is_super_admin() or created_by = public.my_email());

-- ---------- 3) tasks: creator owns, super controls all ----------

drop policy if exists tasks_update_staff on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update to authenticated
  using (public.is_super_admin() or created_by = public.my_email())
  with check (public.is_super_admin() or created_by = public.my_email());

drop policy if exists tasks_delete_staff on public.tasks;
drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using (public.is_super_admin() or created_by = public.my_email());

-- ---------- 4) profiles: super_admin only for role/state fields ----------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    new.role := old.role;
    new.disabled := old.disabled;
    new.disabled_reason := old.disabled_reason;
    new.email := old.email;
    new.legacy_id := old.legacy_id;
  end if;
  new.updated_date := now();
  return new;
end;
$$;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_delete_staff on public.profiles;
drop policy if exists profiles_delete_super on public.profiles;
create policy profiles_delete_super on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

-- ---------- 5) one-time role fix ----------
-- DR THRAX is a regular admin (confirmed) — not a super admin.

update public.profiles
   set role = 'admin'
 where email = 'ammarhendam@gmail.com'
   and role = 'super_admin';
