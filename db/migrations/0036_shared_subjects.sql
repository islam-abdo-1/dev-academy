-- ============================================================
-- 0036 — shared subjects across majors
--
-- A subject is one content entity that can be offered in one
-- or more (major, year, semester) placements. The legacy
-- subjects.major/year/semester/code columns remain in sync
-- with the primary placement for backward compatibility.
-- ============================================================

create table if not exists public.subject_placements (
  id          uuid primary key default gen_random_uuid(),
  subject_id  text not null references public.subjects (id) on delete cascade,
  major       text not null check (major in ('ai', 'cybersecurity')),
  year        text not null check (year in ('year-1', 'year-2', 'year-3', 'year-4')),
  semester    text not null check (semester in ('sem-1', 'sem-2')),
  code        text not null default '',
  is_primary  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint subject_placements_unique_slot unique (subject_id, major, year, semester)
);

create index if not exists subject_placements_catalog_idx
  on public.subject_placements (major, year, semester);

create unique index if not exists subject_placements_one_primary_idx
  on public.subject_placements (subject_id) where is_primary;

alter table public.subject_placements enable row level security;

grant select on public.subject_placements to anon, authenticated;
grant insert, update, delete on public.subject_placements to authenticated;

drop policy if exists subject_placements_select on public.subject_placements;
create policy subject_placements_select on public.subject_placements
  for select to anon, authenticated using (true);

drop policy if exists subject_placements_insert_staff on public.subject_placements;
create policy subject_placements_insert_staff on public.subject_placements
  for insert to authenticated with check (public.is_staff());

drop policy if exists subject_placements_update_staff on public.subject_placements;
create policy subject_placements_update_staff on public.subject_placements
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists subject_placements_delete_staff on public.subject_placements;
create policy subject_placements_delete_staff on public.subject_placements
  for delete to authenticated using (public.is_staff());

-- Backfill every subject that already has a valid placement.
insert into public.subject_placements
  (subject_id, major, year, semester, code, is_primary, sort_order)
select
  s.id, s.major, s.year, s.semester, coalesce(s.code, ''), true, 1
from public.subjects s
where s.major in ('ai', 'cybersecurity')
  and s.year in ('year-1', 'year-2', 'year-3', 'year-4')
  and s.semester in ('sem-1', 'sem-2')
on conflict (subject_id, major, year, semester) do nothing;

-- One row per placement. Existing browse/search code can keep
-- filtering by major/year/semester without knowing that the
-- subject itself is shared.
create or replace view public.subject_catalog
with (security_invoker = true)
as
select
  s.id,
  s.name,
  s.icon,
  s.description,
  s.credits,
  s.tags,
  s.created_date,
  s.updated_date,
  s.created_by_id,
  s.created_by,
  s.is_sample,
  s.english_name,
  count(*) over (partition by s.id)::integer as placement_count,
  p.id as placement_id,
  p.major,
  p.year,
  p.semester,
  p.code,
  p.is_primary,
  p.sort_order
from public.subjects s
join public.subject_placements p on p.subject_id = s.id;

grant select on public.subject_catalog to anon, authenticated;

-- Save the subject together with its placements in one
-- transaction. Staff only.
create or replace function public.save_subject_with_placements(
  p_subject_id text,
  p_subject jsonb,
  p_placements jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_name text;
  v_major text;
  v_year text;
  v_semester text;
  v_code text;
  v_placement jsonb;
  v_index integer;
  v_seen text[] := '{}';
  v_key text;
  v_primary_found boolean := false;
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_name := btrim(coalesce(p_subject->>'name', ''));
  if v_name = '' then
    raise exception 'subject name is required';
  end if;

  if jsonb_typeof(p_placements) <> 'array'
     or jsonb_array_length(p_placements) = 0 then
    raise exception 'at least one placement is required';
  end if;

  for v_placement in
    select value from jsonb_array_elements(p_placements)
  loop
    v_major := coalesce(v_placement->>'major', '');
    v_year := coalesce(v_placement->>'year', '');
    v_semester := coalesce(v_placement->>'semester', '');

    if v_major not in ('ai', 'cybersecurity') then
      raise exception 'invalid major: %', v_major;
    end if;
    if v_year not in ('year-1', 'year-2', 'year-3', 'year-4') then
      raise exception 'invalid year: %', v_year;
    end if;
    if v_semester not in ('sem-1', 'sem-2') then
      raise exception 'invalid semester: %', v_semester;
    end if;

    v_key := v_major || '|' || v_year || '|' || v_semester;
    if v_key = any(v_seen) then
      raise exception 'duplicate placement: %', v_key;
    end if;
    v_seen := array_append(v_seen, v_key);
  end loop;

  if p_subject_id is null or btrim(p_subject_id) = '' then
    v_id := gen_random_uuid()::text;
    insert into public.subjects (
      id, name, icon, description, major, year, semester, credits, tags,
      created_by_id, created_by, is_sample, english_name, code
    ) values (
      v_id,
      v_name,
      nullif(p_subject->>'icon', ''),
      coalesce(p_subject->>'description', ''),
      '', '', '',
      nullif(p_subject->>'credits', '')::integer,
      '{}'::text[],
      auth.uid()::text,
      public.my_email(),
      coalesce((p_subject->>'is_sample')::boolean, false),
      coalesce(p_subject->>'english_name', ''),
      ''
    );
  else
    v_id := btrim(p_subject_id);
    update public.subjects
    set
      name = v_name,
      icon = nullif(p_subject->>'icon', ''),
      description = coalesce(p_subject->>'description', ''),
      credits = nullif(p_subject->>'credits', '')::integer,
      english_name = coalesce(p_subject->>'english_name', '')
    where id = v_id;

    if not found then
      raise exception 'subject not found';
    end if;

    delete from public.subject_placements where subject_id = v_id;
  end if;

  for v_placement, v_index in
    select value, ord::integer
    from jsonb_array_elements(p_placements)
      with ordinality as t(value, ord)
  loop
    v_major := v_placement->>'major';
    v_year := v_placement->>'year';
    v_semester := v_placement->>'semester';
    v_code := coalesce(v_placement->>'code', '');

    insert into public.subject_placements (
      subject_id, major, year, semester, code, is_primary, sort_order
    ) values (
      v_id,
      v_major,
      v_year,
      v_semester,
      v_code,
      case
        when not v_primary_found
          and coalesce((v_placement->>'is_primary')::boolean, false)
        then true
        else false
      end,
      v_index
    );

    if not v_primary_found
       and coalesce((v_placement->>'is_primary')::boolean, false) then
      v_primary_found := true;
    end if;
  end loop;

  if not v_primary_found then
    update public.subject_placements
    set is_primary = true
    where subject_id = v_id
      and sort_order = (
        select min(sort_order)
        from public.subject_placements
        where subject_id = v_id
      );
  end if;

  select major, year, semester, code
  into v_major, v_year, v_semester, v_code
  from public.subject_placements
  where subject_id = v_id and is_primary = true
  limit 1;

  update public.subjects
  set major = v_major,
      year = v_year,
      semester = v_semester,
      code = v_code
  where id = v_id;

  return v_id;
end;
$$;

grant execute on function public.save_subject_with_placements(text, jsonb, jsonb)
  to authenticated;
