-- ============================================================
-- 0034 — material ratings (like / dislike)
--
--   * One vote per user per official material:
--       lecture_items, section_items, resources
--   * Users can only read their own vote; staff can read all.
--   * Writes go through rate_material() so material existence and
--     the active-user check are enforced server-side.
--   * Aggregate reads are exposed through SECURITY DEFINER RPCs,
--     so students can see counts without seeing voter identities.
--   * Ratings are removed automatically when their material is
--     deleted (polymorphic material_id cannot use a single FK).
-- ============================================================

create table if not exists public.material_ratings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  material_type text not null check (material_type in ('lecture_item', 'section_item', 'resource')),
  material_id   text not null,
  value         smallint not null check (value in (-1, 1)),
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  unique (user_id, material_type, material_id)
);

comment on table public.material_ratings is
  'Like (+1) / dislike (-1) votes for official lecture items, section items, and resources.';

create index if not exists material_ratings_material_idx
  on public.material_ratings (material_type, material_id);
create index if not exists material_ratings_updated_idx
  on public.material_ratings (updated_date desc);
create index if not exists profiles_staff_track_idx
  on public.profiles (major, year)
  where role in ('admin', 'super_admin');

drop trigger if exists material_ratings_touch on public.material_ratings;
create trigger material_ratings_touch
  before update on public.material_ratings
  for each row execute function public.touch_updated_date();

-- ---------- row level security ----------
alter table public.material_ratings enable row level security;

drop policy if exists material_ratings_select on public.material_ratings;
create policy material_ratings_select on public.material_ratings
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Direct writes are intentionally disabled. All mutations go through
-- rate_material(), which validates the material and the current user.
revoke all on table public.material_ratings from public, anon, authenticated;
grant select on table public.material_ratings to authenticated;
grant select, insert, update, delete on table public.material_ratings to service_role;

-- ---------- write RPC: rate / change / remove a vote ----------
create or replace function public.rate_material(
  p_material_type text,
  p_material_id text,
  p_value smallint
)
returns table (likes bigint, dislikes bigint, my_vote smallint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean := false;
  v_current smallint;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not authorized';
  end if;

  if p_material_type is null
     or p_material_type not in ('lecture_item', 'section_item', 'resource') then
    raise exception 'invalid material type';
  end if;

  if p_material_id is null or btrim(p_material_id) = '' then
    raise exception 'material id is required';
  end if;

  if p_value is null or p_value not in (-1, 1) then
    raise exception 'invalid rating value';
  end if;

  if p_material_type = 'lecture_item' then
    select exists (
      select 1 from public.lecture_items where id = p_material_id
    ) into v_exists;
  elsif p_material_type = 'section_item' then
    select exists (
      select 1 from public.section_items where id = p_material_id
    ) into v_exists;
  else
    select exists (
      select 1 from public.resources where id = p_material_id
    ) into v_exists;
  end if;

  if not v_exists then
    raise exception 'material not found';
  end if;

  select mr.value into v_current
  from public.material_ratings mr
  where mr.user_id = v_uid
    and mr.material_type = p_material_type
    and mr.material_id = p_material_id;

  if v_current is null then
    insert into public.material_ratings (user_id, material_type, material_id, value)
    values (v_uid, p_material_type, p_material_id, p_value);
  elsif v_current = p_value then
    -- Clicking the same reaction again removes the vote.
    delete from public.material_ratings
    where user_id = v_uid
      and material_type = p_material_type
      and material_id = p_material_id;
  else
    update public.material_ratings
    set value = p_value
    where user_id = v_uid
      and material_type = p_material_type
      and material_id = p_material_id;
  end if;

  return query
  select
    count(*) filter (where mr.value = 1)::bigint as likes,
    count(*) filter (where mr.value = -1)::bigint as dislikes,
    coalesce(max(case when mr.user_id = v_uid then mr.value end), 0)::smallint as my_vote
  from public.material_ratings mr
  where mr.material_type = p_material_type
    and mr.material_id = p_material_id;
end;
$$;

-- ---------- read RPC: one material ----------
create or replace function public.get_material_rating_summary(
  p_material_type text,
  p_material_id text
)
returns table (likes bigint, dislikes bigint, my_vote smallint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not authorized';
  end if;

  return query
  select
    count(*) filter (where mr.value = 1)::bigint as likes,
    count(*) filter (where mr.value = -1)::bigint as dislikes,
    coalesce(max(case when mr.user_id = v_uid then mr.value end), 0)::smallint as my_vote
  from public.material_ratings mr
  where mr.material_type = p_material_type
    and mr.material_id = p_material_id;
end;
$$;

-- ---------- read RPC: every material in a subject ----------
create or replace function public.get_subject_rating_summaries(p_subject_id text)
returns table (
  material_type text,
  material_id text,
  likes bigint,
  dislikes bigint,
  my_vote smallint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not authorized';
  end if;

  return query
  with materials as (
    select 'lecture_item'::text as material_type, li.id as material_id
    from public.lecture_items li
    where li.subject_id = p_subject_id
    union all
    select 'section_item'::text, si.id
    from public.section_items si
    where si.subject_id = p_subject_id
    union all
    select 'resource'::text, r.id
    from public.resources r
    where r.subject_id = p_subject_id
  )
  select
    m.material_type,
    m.material_id,
    count(mr.id) filter (where mr.value = 1)::bigint as likes,
    count(mr.id) filter (where mr.value = -1)::bigint as dislikes,
    coalesce(max(case when mr.user_id = v_uid then mr.value end), 0)::smallint as my_vote
  from materials m
  left join public.material_ratings mr
    on mr.material_type = m.material_type
   and mr.material_id = m.material_id
  group by m.material_type, m.material_id;
end;
$$;

-- ---------- staff RPC: rating overview for the dashboard ----------
create or replace function public.get_material_rating_overview()
returns table (
  material_type text,
  material_id text,
  title text,
  subject_id text,
  subject_name text,
  major text,
  year text,
  semester text,
  likes bigint,
  dislikes bigint,
  total_votes bigint,
  score bigint,
  last_vote_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;

  return query
  with materials as (
    select
      'lecture_item'::text as material_type,
      li.id as material_id,
      li.title,
      li.subject_id,
      s.name as subject_name,
      s.major,
      s.year,
      s.semester
    from public.lecture_items li
    left join public.subjects s on s.id = li.subject_id

    union all

    select
      'section_item'::text,
      si.id,
      si.title,
      si.subject_id,
      s.name,
      s.major,
      s.year,
      s.semester
    from public.section_items si
    left join public.subjects s on s.id = si.subject_id

    union all

    select
      'resource'::text,
      r.id,
      r.title,
      r.subject_id,
      s.name,
      s.major,
      s.year,
      s.semester
    from public.resources r
    left join public.subjects s on s.id = r.subject_id
  ),
  aggregated as (
    select
      m.material_type,
      m.material_id,
      m.title,
      m.subject_id,
      m.subject_name,
      m.major,
      m.year,
      m.semester,
      count(mr.id) filter (where mr.value = 1)::bigint as like_count,
      count(mr.id) filter (where mr.value = -1)::bigint as dislike_count,
      count(mr.id)::bigint as vote_count,
      coalesce(sum(mr.value), 0)::bigint as rating_score,
      max(mr.updated_date) as last_vote
    from materials m
    left join public.material_ratings mr
      on mr.material_type = m.material_type
     and mr.material_id = m.material_id
    group by
      m.material_type, m.material_id, m.title, m.subject_id,
      m.subject_name, m.major, m.year, m.semester
  )
  select
    a.material_type,
    a.material_id,
    a.title,
    a.subject_id,
    a.subject_name,
    a.major,
    a.year,
    a.semester,
    a.like_count as likes,
    a.dislike_count as dislikes,
    a.vote_count as total_votes,
    a.rating_score as score,
    a.last_vote as last_vote_at
  from aggregated a
  order by a.rating_score asc, a.vote_count desc, a.title asc;
end;
$$;

-- ---------- staff RPC: who voted for one material ----------
create or replace function public.get_material_rating_voters(
  p_material_type text,
  p_material_id text
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  value smallint,
  updated_date timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;

  return query
  select
    mr.user_id,
    p.full_name,
    p.email,
    mr.value,
    mr.updated_date
  from public.material_ratings mr
  join public.profiles p on p.id = mr.user_id
  where mr.material_type = p_material_type
    and mr.material_id = p_material_id
  order by mr.updated_date desc;
end;
$$;

-- ---------- cleanup when a material is deleted ----------
create or replace function public.cleanup_material_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.material_ratings
  where material_type = TG_ARGV[0]
    and material_id = OLD.id;
  return OLD;
end;
$$;

drop trigger if exists lecture_items_ratings_cleanup on public.lecture_items;
create trigger lecture_items_ratings_cleanup
  after delete on public.lecture_items
  for each row execute function public.cleanup_material_ratings('lecture_item');

drop trigger if exists section_items_ratings_cleanup on public.section_items;
create trigger section_items_ratings_cleanup
  after delete on public.section_items
  for each row execute function public.cleanup_material_ratings('section_item');

drop trigger if exists resources_ratings_cleanup on public.resources;
create trigger resources_ratings_cleanup
  after delete on public.resources
  for each row execute function public.cleanup_material_ratings('resource');

-- ---------- execute grants ----------
revoke all on function public.rate_material(text, text, smallint) from public, anon;
grant execute on function public.rate_material(text, text, smallint) to authenticated, service_role;

revoke all on function public.get_material_rating_summary(text, text) from public, anon;
grant execute on function public.get_material_rating_summary(text, text) to authenticated, service_role;

revoke all on function public.get_subject_rating_summaries(text) from public, anon;
grant execute on function public.get_subject_rating_summaries(text) to authenticated, service_role;

revoke all on function public.get_material_rating_overview() from public, anon;
grant execute on function public.get_material_rating_overview() to authenticated, service_role;

revoke all on function public.get_material_rating_voters(text, text) from public, anon;
grant execute on function public.get_material_rating_voters(text, text) to authenticated, service_role;

revoke all on function public.cleanup_material_ratings() from public, anon, authenticated;
