create table if not exists public.comments (
  id bigserial primary key,

  entity_type text not null,
  entity_id text not null,

  comment_text text not null,

  created_by_user_id text null,
  created_by_name text null,
  employee_number integer null,

  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_user_id text null,
  deleted_by_name text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_comments_entity_created
  on public.comments (entity_type, entity_id, created_at desc, id desc);

create index if not exists ix_comments_not_deleted
  on public.comments (is_deleted, created_at desc);