-- ============================================================
-- Dev Academy - storage bucket for uploads (pdf, html, images...)
-- Public bucket: files are served through public URLs.
-- Writes are restricted to staff.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects
  for select
  using (bucket_id = 'media');

drop policy if exists media_staff_insert on storage.objects;
create policy media_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff());

drop policy if exists media_staff_update on storage.objects;
create policy media_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_staff())
  with check (bucket_id = 'media' and public.is_staff());

drop policy if exists media_staff_delete on storage.objects;
create policy media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_staff());
