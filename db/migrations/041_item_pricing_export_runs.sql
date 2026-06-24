-- 041_item_pricing_export_runs.sql
-- Phase 4: Internal base pricing CSV export history for Item Pricing Setup.

CREATE TABLE IF NOT EXISTS public.item_pricing_export_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id uuid NOT NULL REFERENCES public.item_pricing_price_books(id),
  export_type text NOT NULL DEFAULT 'BASE_PRICING_CSV',
  file_name text NOT NULL,
  file_format text NOT NULL DEFAULT 'CSV',
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'COMPLETED',
  csv_content text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  CONSTRAINT item_pricing_export_runs_export_type_chk CHECK (export_type IN ('BASE_PRICING_CSV')),
  CONSTRAINT item_pricing_export_runs_file_format_chk CHECK (file_format IN ('CSV')),
  CONSTRAINT item_pricing_export_runs_status_chk CHECK (status IN ('COMPLETED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_item_pricing_export_runs_price_book_created
  ON public.item_pricing_export_runs(price_book_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_pricing_export_runs_type_created
  ON public.item_pricing_export_runs(export_type, created_at DESC);

COMMENT ON TABLE public.item_pricing_export_runs IS 'Internal export history for Item Pricing Setup base pricing CSV outputs.';
COMMENT ON COLUMN public.item_pricing_export_runs.csv_content IS 'Phase 4 stores generated CSV content in the database for simple internal download/history. Future phases can move large files to S3 if needed.';
