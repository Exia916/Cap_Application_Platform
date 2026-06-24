-- 042_item_pricing_foundation_hardening.sql
-- Item Pricing Setup Phase 5A: foundation hardening, validation runs, lifecycle audit fields.

BEGIN;

ALTER TABLE public.item_pricing_price_books
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS review_requested_by text NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS published_by text NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by text NULL,
  ADD COLUMN IF NOT EXISTS default_set_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS default_set_by text NULL,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_validation_status text NULL,
  ADD COLUMN IF NOT EXISTS last_validation_error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_validation_warning_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_pricing_price_books_validation_status_chk'
      AND conrelid = 'public.item_pricing_price_books'::regclass
  ) THEN
    ALTER TABLE public.item_pricing_price_books
      ADD CONSTRAINT item_pricing_price_books_validation_status_chk
      CHECK (last_validation_status IS NULL OR last_validation_status IN ('PASSED', 'WARNINGS', 'FAILED'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.item_pricing_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id uuid NOT NULL REFERENCES public.item_pricing_price_books(id) ON DELETE CASCADE,
  validation_type text NOT NULL DEFAULT 'FOUNDATION',
  status text NOT NULL DEFAULT 'COMPLETED',
  item_count integer NOT NULL DEFAULT 0,
  issue_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  notes text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_pricing_validation_runs_status_chk'
      AND conrelid = 'public.item_pricing_validation_runs'::regclass
  ) THEN
    ALTER TABLE public.item_pricing_validation_runs
      ADD CONSTRAINT item_pricing_validation_runs_status_chk
      CHECK (status IN ('RUNNING', 'PASSED', 'WARNINGS', 'FAILED'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.item_pricing_validation_issues (
  id bigserial PRIMARY KEY,
  validation_run_id uuid NOT NULL REFERENCES public.item_pricing_validation_runs(id) ON DELETE CASCADE,
  severity text NOT NULL,
  issue_code text NOT NULL,
  entity_type text NULL,
  entity_id text NULL,
  item_id uuid NULL REFERENCES public.item_pricing_items(id) ON DELETE SET NULL,
  item_code text NULL,
  rule_set_id integer NULL REFERENCES public.item_pricing_rule_sets(id) ON DELETE SET NULL,
  rule_set_code text NULL,
  decoration_method_code text NULL,
  quantity_break_code text NULL,
  message text NOT NULL,
  details_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_pricing_validation_issues_severity_chk'
      AND conrelid = 'public.item_pricing_validation_issues'::regclass
  ) THEN
    ALTER TABLE public.item_pricing_validation_issues
      ADD CONSTRAINT item_pricing_validation_issues_severity_chk
      CHECK (severity IN ('ERROR', 'WARNING'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_item_pricing_validation_runs_price_book
  ON public.item_pricing_validation_runs(price_book_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_pricing_validation_issues_run
  ON public.item_pricing_validation_issues(validation_run_id, severity, issue_code);

CREATE INDEX IF NOT EXISTS idx_item_pricing_validation_issues_item
  ON public.item_pricing_validation_issues(item_id, item_code);

COMMIT;
