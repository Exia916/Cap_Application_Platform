create table if not exists public.attachments (
  id bigserial primary key,

  entity_type text not null,
  entity_id text not null,

  original_file_name text not null,
  stored_file_name text not null,
  stored_relative_path text not null,

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

create index if not exists ix_attachments_entity_created
  on public.attachments (entity_type, entity_id, created_at desc, id desc);

create index if not exists ix_attachments_not_deleted
  on public.attachments (is_deleted, created_at desc);