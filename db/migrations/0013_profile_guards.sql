-- ============================================================
-- 0013 — harden profile role/status guards
--
--   * A super admin can no longer change their own role or
--     disable their own account (this is how the account was
--     downgraded by mistake).
--   * Only an active super admin can change roles/status of
--     other profiles.
--   * The last active super admin can never be demoted,
--     disabled, or deleted.
--   * Self-service edits keep locking role/email/legacy_id.
--   * Deletes: no self-delete, super admin only, last active
--     super admin protected.
-- ============================================================

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_super boolean := public.is_super_admin();
begin
  new.updated_date := now();

  if new.role is distinct from old.role
     or new.disabled is distinct from old.disabled
     or new.disabled_reason is distinct from old.disabled_reason then
    if v_uid is null then
      return new;
    end if;

    if new.id = v_uid then
      raise exception 'cannot change your own role or status';
    end if;

    if not v_is_super then
      raise exception 'only an active super admin can change roles';
    end if;

    if old.role = 'super_admin'
       and (new.role <> 'super_admin' or coalesce(new.disabled, false)) then
      if not exists (
        select 1
        from public.profiles
        where id <> old.id
          and role = 'super_admin'
          and coalesce(disabled, false) = false
      ) then
        raise exception 'at least one active super admin is required';
      end if;
    end if;
  elsif v_uid is not null and not v_is_super then
    if old.id <> v_uid then
      raise exception 'not allowed';
    end if;
    new.role := old.role;
    new.disabled := old.disabled;
    new.disabled_reason := old.disabled_reason;
    new.email := old.email;
    new.legacy_id := old.legacy_id;
  end if;

  return new;
end;
$$;

create or replace function public.guard_profile_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is not null then
    if old.id = v_uid then
      raise exception 'cannot delete your own account';
    end if;
    if not public.is_super_admin() then
      raise exception 'only an active super admin can delete profiles';
    end if;
  end if;

  if old.role = 'super_admin' and coalesce(old.disabled, false) = false then
    if not exists (
      select 1
      from public.profiles
      where id <> old.id
        and role = 'super_admin'
        and coalesce(disabled, false) = false
    ) then
      raise exception 'cannot delete the last active super admin';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists profiles_guard_delete on public.profiles;
create trigger profiles_guard_delete
  before delete on public.profiles
  for each row execute function public.guard_profile_delete();
