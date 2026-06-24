-- 040_item_pricing_update_batches.sql
-- Phase 3 Item Pricing Setup: price update batches with before/after preview and apply workflow.

CREATE SEQUENCE IF NOT EXISTS public.item_pricing_update_batch_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.item_pricing_update_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL DEFAULT ('IPU-' || lpad(nextval('public.item_pricing_update_batch_number_seq')::text, 6, '0')),
  price_book_id uuid NOT NULL REFERENCES public.item_pricing_price_books(id) ON DELETE CASCADE,
  name text NOT NULL,
  update_type text NOT NULL,
  adjustment_type text NOT NULL,
  adjustment_value numeric(12, 4) NULL,
  criteria_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT',
  notes text NULL,
  row_count integer NOT NULL DEFAULT 0,
  valid_row_count integer NOT NULL DEFAULT 0,
  warning_row_count integer NOT NULL DEFAULT 0,
  error_row_count integer NOT NULL DEFAULT 0,
  applied_row_count integer NOT NULL DEFAULT 0,
  skipped_row_count integer NOT NULL DEFAULT 0,
  snapshot_error_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  validated_at timestamptz NULL,
  validated_by text NULL,
  applied_at timestamptz NULL,
  applied_by text NULL,
  is_voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz NULL,
  voided_by text NULL,
  void_reason text NULL,
  CONSTRAINT item_pricing_update_batches_number_ux UNIQUE (batch_number),
  CONSTRAINT item_pricing_update_batches_update_type_chk
    CHECK (update_type IN ('INDIVIDUAL_ITEM', 'FILTERED_ITEMS', 'CSV_UPLOAD', 'WHOLE_PRICE_BOOK')),
  CONSTRAINT item_pricing_update_batches_adjustment_type_chk
    CHECK (adjustment_type IN ('SET_PRICE', 'ADD_AMOUNT', 'PERCENT_CHANGE')),
  CONSTRAINT item_pricing_update_batches_status_chk
    CHECK (status IN ('DRAFT', 'VALIDATED', 'APPLIED', 'FAILED', 'VOIDED')),
  CONSTRAINT item_pricing_update_batches_counts_chk
    CHECK (
      row_count >= 0
      AND valid_row_count >= 0
      AND warning_row_count >= 0
      AND error_row_count >= 0
      AND applied_row_count >= 0
      AND skipped_row_count >= 0
      AND snapshot_error_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS ix_item_pricing_update_batches_price_book
  ON public.item_pricing_update_batches (price_book_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_item_pricing_update_batches_status
  ON public.item_pricing_update_batches (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.item_pricing_update_batch_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.item_pricing_update_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  item_id uuid NULL REFERENCES public.item_pricing_items(id),
  item_code text NULL,
  item_description text NULL,
  rule_set_id integer NULL REFERENCES public.item_pricing_rule_sets(id),
  rule_set_code text NULL,
  old_blank_eqp numeric(12, 4) NULL,
  new_blank_eqp numeric(12, 4) NULL,
  change_amount numeric(12, 4) NULL,
  change_percent numeric(12, 4) NULL,
  old_flat_eqp numeric(12, 4) NULL,
  new_flat_eqp numeric(12, 4) NULL,
  old_3d_eqp numeric(12, 4) NULL,
  new_3d_eqp numeric(12, 4) NULL,
  status text NOT NULL DEFAULT 'ERROR',
  warning_message text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz NULL,
  CONSTRAINT item_pricing_update_batch_rows_status_chk
    CHECK (status IN ('VALID', 'WARNING', 'ERROR', 'APPLIED', 'SKIPPED')),
  CONSTRAINT item_pricing_update_batch_rows_row_number_chk
    CHECK (row_number > 0),
  CONSTRAINT item_pricing_update_batch_rows_prices_chk
    CHECK (
      (old_blank_eqp IS NULL OR old_blank_eqp >= 0)
      AND (new_blank_eqp IS NULL OR new_blank_eqp >= 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_item_pricing_update_batch_rows_batch_row
  ON public.item_pricing_update_batch_rows (batch_id, row_number);

CREATE INDEX IF NOT EXISTS ix_item_pricing_update_batch_rows_batch_status
  ON public.item_pricing_update_batch_rows (batch_id, status, row_number);

CREATE INDEX IF NOT EXISTS ix_item_pricing_update_batch_rows_item
  ON public.item_pricing_update_batch_rows (item_id);
