-- 039_item_pricing_imports.sql
-- Phase 2 Item Pricing Setup: CSV import staging, validation, and apply workflow.

CREATE TABLE IF NOT EXISTS public.item_pricing_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id uuid NOT NULL REFERENCES public.item_pricing_price_books(id) ON DELETE CASCADE,
  import_type text NOT NULL DEFAULT 'BASE_PRICE_CSV',
  status text NOT NULL DEFAULT 'STAGED',
  file_name text NULL,
  source_sheet_name text NULL,
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
  CONSTRAINT item_pricing_import_batches_import_type_chk
    CHECK (import_type IN ('BASE_PRICE_CSV')),
  CONSTRAINT item_pricing_import_batches_status_chk
    CHECK (status IN ('STAGED', 'VALIDATED', 'APPLIED', 'FAILED', 'VOIDED')),
  CONSTRAINT item_pricing_import_batches_counts_chk
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

CREATE INDEX IF NOT EXISTS ix_item_pricing_import_batches_price_book
  ON public.item_pricing_import_batches (price_book_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_item_pricing_import_batches_status
  ON public.item_pricing_import_batches (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.item_pricing_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.item_pricing_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  item_code text NULL,
  item_description text NULL,
  product_family text NULL,
  rule_set_code text NULL,
  rule_set_id integer NULL REFERENCES public.item_pricing_rule_sets(id),
  blank_eqp_price numeric(12, 4) NULL,
  active boolean NULL,
  allows_blank_override boolean NULL,
  allows_flat_emb_override boolean NULL,
  allows_3d_emb_override boolean NULL,
  allows_knit_in_override boolean NULL,
  notes text NULL,
  source_file_name text NULL,
  source_sheet_name text NULL,
  status text NOT NULL DEFAULT 'ERROR',
  error_message text NULL,
  warning_message text NULL,
  existing_item_id uuid NULL REFERENCES public.item_pricing_items(id),
  applied_item_id uuid NULL REFERENCES public.item_pricing_items(id),
  applied_base_price_id uuid NULL REFERENCES public.item_pricing_item_base_prices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz NULL,
  CONSTRAINT item_pricing_import_rows_status_chk
    CHECK (status IN ('VALID', 'WARNING', 'ERROR', 'APPLIED', 'SKIPPED')),
  CONSTRAINT item_pricing_import_rows_row_number_chk
    CHECK (row_number > 0),
  CONSTRAINT item_pricing_import_rows_blank_chk
    CHECK (blank_eqp_price IS NULL OR blank_eqp_price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_item_pricing_import_rows_batch_row
  ON public.item_pricing_import_rows (batch_id, row_number);

CREATE INDEX IF NOT EXISTS ix_item_pricing_import_rows_batch_status
  ON public.item_pricing_import_rows (batch_id, status, row_number);

CREATE INDEX IF NOT EXISTS ix_item_pricing_import_rows_item_code
  ON public.item_pricing_import_rows (upper(item_code));
