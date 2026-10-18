-- ============================================================
-- Dev Academy - initial schema
-- Mirrors the Base44 data model (field names kept identical so
-- the one-time import is a straight copy). IDs are text so the
-- original Base44 ids are preserved during import; new rows get
-- gen_random_uuid()::text.
-- ============================================================

-- ---------- profiles (mirrors auth.users) ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  legacy_id     text unique,
  email         text not null unique,
  full_name     text,
  role          text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  major         text,
  year          text,
  semester      text,
  avatar_url    text,
  disabled      boolean not null default false,
  disabled_reason text,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now()
);

-- ---------- subjects ----------
create table if not exists public.subjects (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  icon          text,
  description   text default '',
  major         text default '',
  year          text default '',
  semester      text default '',
  credits       integer,
  tags          text[] not null default '{}',
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- chapters ----------
create table if not exists public.chapters (
  id            text primary key default gen_random_uuid()::text,
  subject_id    text not null references public.subjects (id) on delete cascade,
  title         text not null default '',
  description   text default '',
  "order"       integer not null default 0,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- lectures ----------
create table if not exists public.lectures (
  id            text primary key default gen_random_uuid()::text,
  subject_id    text not null references public.subjects (id) on delete cascade,
  chapter_id    text references public.chapters (id) on delete cascade,
  title         text not null default '',
  description   text default '',
  "order"       integer not null default 0,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- sections ----------
create table if not exists public.sections (
  id            text primary key default gen_random_uuid()::text,
  subject_id    text not null references public.subjects (id) on delete cascade,
  chapter_id    text references public.chapters (id) on delete cascade,
  title         text not null default '',
  description   text default '',
  "order"       integer not null default 0,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- lecture_items ----------
create table if not exists public.lecture_items (
  id            text primary key default gen_random_uuid()::text,
  subject_id    text not null references public.subjects (id) on delete cascade,
  chapter_id    text references public.chapters (id) on delete cascade,
  lecture_id    text references public.lectures (id) on delete cascade,
  title         text not null default '',
  description   text,
  type          text not null default 'file' check (type in ('file', 'video')),
  file_type     text,
  url           text,
  "order"       integer not null default 0,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- section_items ----------
create table if not exists public.section_items (
  id            text primary key default gen_random_uuid()::text,
  subject_id    text not null references public.subjects (id) on delete cascade,
  chapter_id    text references public.chapters (id) on delete cascade,
  section_id    text references public.sections (id) on delete cascade,
  title         text not null default '',
  description   text,
  type          text not null default 'file' check (type in ('file', 'video')),
  file_type     text,
  url           text,
  "order"       integer not null default 0,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- resources ----------
create table if not exists public.resources (
  id            text primary key default gen_random_uuid()::text,
  subject_id    text references public.subjects (id) on delete cascade,
  title         text not null default '',
  description   text default '',
  url           text,
  type          text default 'link',
  tags          text[] not null default '{}',
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- favorites ----------
create table if not exists public.favorites (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  subject_id    text not null references public.subjects (id) on delete cascade,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false,
  unique (user_id, subject_id)
);

-- ---------- subject_views ----------
create table if not exists public.subject_views (
  id            text primary key default gen_random_uuid()::text,
  subject_id    text references public.subjects (id) on delete cascade,
  subject_name  text,
  viewed_by     text,
  user_id       uuid references public.profiles (id) on delete set null,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- activity_logs ----------
create table if not exists public.activity_logs (
  id            text primary key default gen_random_uuid()::text,
  action        text not null default '',
  entity_type   text,
  entity_name   text,
  performed_by  text,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- messages ----------
create table if not exists public.messages (
  id            text primary key default gen_random_uuid()::text,
  to_email      text not null,
  from_email    text not null,
  from_name     text,
  subject       text not null default '',
  body          text not null default '',
  read          boolean not null default false,
  path          text,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- announcements ----------
create table if not exists public.announcements (
  id            text primary key default gen_random_uuid()::text,
  title         text not null default '',
  body          text default '',
  subject_id    text references public.subjects (id) on delete cascade,
  pinned        boolean not null default false,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by_id text,
  created_by    text,
  is_sample     boolean not null default false
);

-- ---------- indexes ----------
create index if not exists chapters_subject_id_idx    on public.chapters (subject_id, "order");
create index if not exists lectures_subject_id_idx    on public.lectures (subject_id, "order");
create index if not exists lectures_chapter_id_idx    on public.lectures (chapter_id);
create index if not exists sections_subject_id_idx    on public.sections (subject_id, "order");
create index if not exists sections_chapter_id_idx    on public.sections (chapter_id);
create index if not exists lecture_items_lecture_idx  on public.lecture_items (lecture_id, "order");
create index if not exists lecture_items_subject_idx  on public.lecture_items (subject_id);
create index if not exists section_items_section_idx  on public.section_items (section_id, "order");
create index if not exists resources_subject_idx      on public.resources (subject_id);
create index if not exists favorites_user_idx         on public.favorites (user_id);
create index if not exists favorites_subject_idx      on public.favorites (subject_id);
create index if not exists subject_views_subject_idx  on public.subject_views (subject_id);
create index if not exists subject_views_created_idx  on public.subject_views (created_date desc);
create index if not exists activity_logs_created_idx  on public.activity_logs (created_date desc);
create index if not exists messages_to_email_idx      on public.messages (to_email, created_date desc);
create index if not exists messages_from_email_idx    on public.messages (from_email);
create index if not exists announcements_created_idx  on public.announcements (created_date desc);

-- ---------- grants ----------
-- RLS narrows rows; grants decide which roles may attempt access at all.
grant select, insert, update, delete on
  public.profiles,
  public.subjects,
  public.chapters,
  public.lectures,
  public.sections,
  public.lecture_items,
  public.section_items,
  public.resources,
  public.favorites,
  public.subject_views,
  public.activity_logs,
  public.messages,
  public.announcements
to authenticated;

grant all on
  public.profiles,
  public.subjects,
  public.chapters,
  public.lectures,
  public.sections,
  public.lecture_items,
  public.section_items,
  public.resources,
  public.favorites,
  public.subject_views,
  public.activity_logs,
  public.messages,
  public.announcements
to service_role;
