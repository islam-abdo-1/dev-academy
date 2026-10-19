-- ============================================================
-- 0011 — role options + profile self-heal
--
--   * doctor / assistant are offered in the Team UI and used as
--     broadcast targets, but the check constraint rejected them,
--     so those roles could never be saved.
--   * ensure_my_profile(): recreates a missing own profile row
--     (role locked to 'user') so an account can never end up in
--     the half-broken state of "auth user without profile".
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['user', 'admin', 'super_admin', 'doctor', 'assistant']));

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_email text;
  v_meta jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if found then
    return v_profile;
  end if;

  select u.email, u.raw_user_meta_data
    into v_email, v_meta
    from auth.users u
   where u.id = v_uid;
  if not found then
    raise exception 'Auth user not found';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    v_uid,
    coalesce(v_email, ''),
    coalesce(
      v_meta ->> 'full_name',
      v_meta ->> 'name',
      split_part(coalesce(v_email, ''), '@', 1)
    ),
    coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture'),
    'user'
  )
  on conflict (id) do nothing;

  select * into v_profile from public.profiles where id = v_uid;
  return v_profile;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;
