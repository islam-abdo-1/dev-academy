alter table public.lecture_items
  add column if not exists drive_file_name text,
  add column if not exists drive_mime_type text;

alter table public.section_items
  add column if not exists drive_file_name text,
  add column if not exists drive_mime_type text;
