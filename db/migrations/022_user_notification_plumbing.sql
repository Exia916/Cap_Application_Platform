-- db/migrations/022_user_notification_plumbing.sql
-- Phase 1: User notification plumbing foundation.
--
-- Safe/backward-compatible:
-- - email remains nullable
-- - notification preferences have defaults
-- - manager_user_id is nullable
-- - last_login_at is system-managed and nullable
--
-- Run during a normal maintenance window after checking for duplicate non-null emails.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email text NULL,
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_app_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL,
  ADD COLUMN IF NOT EXISTS manager_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz NULL;

-- Email remains optional, but when present it should be unique case-insensitively.
-- Before running in production, check:
--
-- SELECT lower(btrim(email)) AS email_key, COUNT(*)
-- FROM public.users
-- WHERE email IS NOT NULL AND btrim(email) <> ''
-- GROUP BY lower(btrim(email))
-- HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower_not_null
  ON public.users (lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS idx_users_manager_user_id
  ON public.users(manager_user_id);

CREATE INDEX IF NOT EXISTS idx_users_last_login_at
  ON public.users(last_login_at);

CREATE INDEX IF NOT EXISTS idx_users_notification_enabled
  ON public.users(email_notifications_enabled, in_app_notifications_enabled)
  WHERE is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_updated_by_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_updated_by_fkey
      FOREIGN KEY (updated_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_manager_user_id_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_manager_user_id_fkey
      FOREIGN KEY (manager_user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_manager_not_self_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_manager_not_self_check
      CHECK (manager_user_id IS NULL OR manager_user_id <> id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_email_format_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_email_format_check
      CHECK (
        email IS NULL
        OR btrim(email) = ''
        OR email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.users
  VALIDATE CONSTRAINT users_email_format_check;

COMMIT;