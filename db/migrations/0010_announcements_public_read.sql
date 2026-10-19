-- Fix: announcements should be publicly readable like tasks
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select using (true);