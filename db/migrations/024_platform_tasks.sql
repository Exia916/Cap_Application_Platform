-- db/migrations/024_platform_tasks.sql
-- Shared CAP Tasks & Assignments foundation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.platform_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  task_number bigserial UNIQUE,
  task_key text NULL,

  source_module text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  source_record_label text NULL,

  task_type text NOT NULL,

  title text NOT NULL,
  description text NULL,

  assigned_to_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_role text NULL,
  assigned_to_department text NULL,
  assigned_to_display_name text NULL,

  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'canceled', 'voided')),

  due_at timestamptz NULL,

  completed_at timestamptz NULL,
  completed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,

  canceled_at timestamptz NULL,
  canceled_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,

  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,

  is_voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz NULL,
  voided_by text NULL,
  void_reason text NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.platform_task_events (
  id bigserial PRIMARY KEY,

  task_id uuid NOT NULL REFERENCES public.platform_tasks(id) ON DELETE CASCADE,

  event_type text NOT NULL
    CHECK (
      event_type IN (
        'created',
        'assigned',
        'reassigned',
        'due_date_changed',
        'status_changed',
        'completed',
        'canceled',
        'reopened',
        'voided'
      )
    ),

  previous_value jsonb NULL,
  new_value jsonb NULL,
  message text NULL,

  actor_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_source
  ON public.platform_tasks(source_module, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_status
  ON public.platform_tasks(status);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_assigned_user_status
  ON public.platform_tasks(assigned_to_user_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_assigned_department_status
  ON public.platform_tasks(assigned_to_department, status, due_at);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_assigned_role_status
  ON public.platform_tasks(assigned_to_role, status, due_at);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_due_at
  ON public.platform_tasks(due_at);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_task_type
  ON public.platform_tasks(task_type);

CREATE INDEX IF NOT EXISTS idx_platform_tasks_created_at
  ON public.platform_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_task_events_task_created
  ON public.platform_task_events(task_id, created_at DESC, id DESC);

-- Prevent duplicate active generated tasks for the same source/task/person.
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_tasks_open_source_user
  ON public.platform_tasks(source_module, entity_type, entity_id, task_type, assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL
    AND COALESCE(is_voided, false) = false
    AND status IN ('open', 'in_progress', 'blocked');

COMMIT;