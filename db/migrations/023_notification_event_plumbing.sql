-- db/migrations/023_notification_event_plumbing.sql
-- Phase 4: Notification event plumbing foundation.
--
-- This creates the shared event/delivery model for future CAP Tasks,
-- Workflow notifications, shipment follow-ups, compliance reminders,
-- and escalation logic.
--
-- This does NOT send email. It only records notification events and
-- delivery rows.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type text NOT NULL,
  module text NULL,

  entity_type text NULL,
  entity_id text NULL,

  actor_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,

  title text NOT NULL,
  message text NULL,

  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_events_event_type
  ON public.notification_events(event_type);

CREATE INDEX IF NOT EXISTS idx_notification_events_module
  ON public.notification_events(module);

CREATE INDEX IF NOT EXISTS idx_notification_events_entity
  ON public.notification_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_notification_events_actor_user_id
  ON public.notification_events(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_events_target_user_id
  ON public.notification_events(target_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_events_created_at
  ON public.notification_events(created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  notification_event_id uuid NOT NULL
    REFERENCES public.notification_events(id)
    ON DELETE CASCADE,

  recipient_user_id uuid NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,

  channel text NOT NULL
    CHECK (channel IN ('in_app', 'email')),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),

  recipient_email text NULL,

  attempted_at timestamptz NULL,
  delivered_at timestamptz NULL,
  read_at timestamptz NULL,

  error_message text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (notification_event_id, recipient_user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_event
  ON public.notification_deliveries(notification_event_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON public.notification_deliveries(recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient_channel_created
  ON public.notification_deliveries(recipient_user_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient_status
  ON public.notification_deliveries(recipient_user_id, status);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_unread_in_app
  ON public.notification_deliveries(recipient_user_id, created_at DESC)
  WHERE channel = 'in_app'
    AND status = 'sent'
    AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending_email
  ON public.notification_deliveries(created_at ASC)
  WHERE channel = 'email'
    AND status = 'pending';

COMMIT;