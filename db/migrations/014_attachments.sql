create table if not exists public.attachments (
  id bigserial primary key,

  entity_type text not null,
  entity_id text not null,

  original_file_name text not null,
  stored_file_name text not null,
  stored_relative_path text not null,

  storage_provider text not null default 's3',
  bucket_name text null,
  object_key text null,
  object_version_id text null,
  attachment_comment text null,

  mime_type text null,
  file_size_bytes bigint null,

  uploaded_by_user_id text null,
  uploaded_by_name text null,
  employee_number integer null,

  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_user_id text null,
  deleted_by_name text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attachments
  add column if not exists storage_provider text not null default 's3';

alter table public.attachments
  add column if not exists bucket_name text null;

alter table public.attachments
  add column if not exists object_key text null;

alter table public.attachments
  add column if not exists object_version_id text null;

alter table public.attachments
  add column if not exists attachment_comment text null;

create index if not exists ix_attachments_entity_created
  on public.attachments (entity_type, entity_id, created_at desc, id desc);

create index if not exists ix_attachments_not_deleted
  on public.attachments (is_deleted, created_at desc);

create index if not exists ix_attachments_bucket_object
  on public.attachments (bucket_name, object_key);

create unique index if not exists ux_attachments_entity_filename_active
  on public.attachments (entity_type, entity_id, lower(original_file_name))
  where is_deleted = false;
