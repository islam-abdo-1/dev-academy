-- ============================================================
-- Dev Academy - allow signed-in users to manage their own avatar
-- objects inside the public media bucket.
-- Avatar path convention: avatars/<auth-uid>.<ext>
-- ============================================================

drop policy if exists media_avatar_insert on storage.objects;
create policy media_avatar_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and name like 'avatars/' || auth.uid()::text || '.%'
  );

drop policy if exists media_avatar_update on storage.objects;
create policy media_avatar_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and name like 'avatars/' || auth.uid()::text || '.%'
  )
  with check (
    bucket_id = 'media'
    and name like 'avatars/' || auth.uid()::text || '.%'
  );

drop policy if exists media_avatar_delete on storage.objects;
create policy media_avatar_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and name like 'avatars/' || auth.uid()::text || '.%'
  );
