-- ============================================================
-- Dev Academy - helper functions + triggers
-- ============================================================

-- ---------- role helpers (security definer to avoid RLS recursion) ----------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
      and p.disabled = false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
      and p.disabled = false
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.disabled = false
  );
$$;

create or replace function public.my_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email from public.profiles p where p.id = auth.uid();
$$;

-- ---------- keep updated_date fresh ----------

create or replace function public.touch_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'subjects', 'chapters', 'lectures', 'sections', 'lecture_items',
    'section_items', 'resources', 'favorites', 'subject_views',
    'activity_logs', 'messages', 'announcements'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I;
       create trigger %I before update on public.%I
       for each row execute function public.touch_updated_date();',
      t || '_touch', t, t || '_touch', t
    );
  end loop;
end;
$$;

-- ---------- profiles: guard self-service updates ----------
-- Normal users may update their own profile fields, but must not
-- change role / disabled / email / legacy_id. Staff and server
-- contexts (service_role, postgres) are allowed to change anything.

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staff() then
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

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
before update on public.profiles
for each row execute function public.guard_profile_update();

-- ---------- auto-create a profile for every new auth user ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
