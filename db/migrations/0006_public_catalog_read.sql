-- ============================================================
-- Dev Academy - public catalog read (anonymous browsing)
-- Visitors may browse the curriculum structure without an
-- account. Lecture/section content items, resources and
-- announcements remain restricted to active users.
-- ============================================================

grant select on
  public.subjects,
  public.chapters,
  public.lectures,
  public.sections
to anon;

do $$
declare
  t text;
begin
  foreach t in array array['subjects', 'chapters', 'lectures', 'sections']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_select', t
    );
  end loop;
end;
$$;
