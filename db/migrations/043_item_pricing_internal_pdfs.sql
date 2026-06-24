-- 043_item_pricing_internal_pdfs.sql
-- Phase 6: Internal PDF outputs for Item Pricing Setup exports.

ALTER TABLE IF EXISTS public.item_pricing_export_runs
  ADD COLUMN IF NOT EXISTS pdf_content_base64 text NULL,
  ADD COLUMN IF NOT EXISTS content_mime_type text NULL,
  ADD COLUMN IF NOT EXISTS content_size_bytes integer NULL;

ALTER TABLE IF EXISTS public.item_pricing_export_runs
  DROP CONSTRAINT IF EXISTS item_pricing_export_runs_export_type_chk;

ALTER TABLE IF EXISTS public.item_pricing_export_runs
  ADD CONSTRAINT item_pricing_export_runs_export_type_chk
  CHECK (export_type IN (
    'BASE_PRICING_CSV',
    'BASE_PRICING_PDF',
    'ITEM_DETAIL_PDF',
    'PRICE_BOOK_SUMMARY_PDF'
  ));

ALTER TABLE IF EXISTS public.item_pricing_export_runs
  DROP CONSTRAINT IF EXISTS item_pricing_export_runs_file_format_chk;

ALTER TABLE IF EXISTS public.item_pricing_export_runs
  ADD CONSTRAINT item_pricing_export_runs_file_format_chk
  CHECK (file_format IN ('CSV', 'PDF'));

CREATE INDEX IF NOT EXISTS idx_item_pricing_export_runs_format_created
  ON public.item_pricing_export_runs(file_format, created_at DESC);

COMMENT ON COLUMN public.item_pricing_export_runs.pdf_content_base64 IS 'Generated internal PDF content encoded as base64 for simple Phase 6 download/history. Future phases can move larger files to S3 if needed.';
COMMENT ON COLUMN public.item_pricing_export_runs.content_mime_type IS 'Generated export MIME type, such as text/csv or application/pdf.';
COMMENT ON COLUMN public.item_pricing_export_runs.content_size_bytes IS 'Generated export content size in bytes.';
