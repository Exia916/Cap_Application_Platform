-- db/migrations/034_quick_turn_quote_customer_header_fields.sql
-- Move key customer-facing quote header fields onto the saved Quick Turn quote header.

BEGIN;

ALTER TABLE public.quick_turn_quotes
  ADD COLUMN IF NOT EXISTS prepared_for_customer_id bigint NULL REFERENCES public.design_workflow_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prepared_for_customer_code_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS prepared_for_customer_name_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS quote_prepared_for_display text NULL,
  ADD COLUMN IF NOT EXISTS program_logo_text text NULL,
  ADD COLUMN IF NOT EXISTS fob text NULL;

-- Preserve any customer export setup already entered before this migration by backfilling
-- quote-level fields only where the quote header does not already have values.
DO $$
BEGIN
  IF to_regclass('public.quick_turn_quote_customer_exports') IS NOT NULL THEN
    UPDATE public.quick_turn_quotes q
    SET prepared_for_customer_id = COALESCE(q.prepared_for_customer_id, e.prepared_for_customer_id),
        prepared_for_customer_code_snapshot = COALESCE(q.prepared_for_customer_code_snapshot, e.prepared_for_customer_code_snapshot),
        prepared_for_customer_name_snapshot = COALESCE(q.prepared_for_customer_name_snapshot, e.prepared_for_customer_name_snapshot),
        quote_prepared_for_display = COALESCE(q.quote_prepared_for_display, e.quote_prepared_for_display),
        program_logo_text = COALESCE(q.program_logo_text, e.program_logo_text),
        fob = COALESCE(q.fob, e.fob)
    FROM public.quick_turn_quote_customer_exports e
    WHERE e.quote_id = q.id;
  END IF;
END $$;

UPDATE public.quick_turn_quotes
SET fob = '1 U.S. Final Destination'
WHERE fob IS NULL OR btrim(fob) = '';

CREATE INDEX IF NOT EXISTS idx_qt_quotes_prepared_for_customer
  ON public.quick_turn_quotes(prepared_for_customer_id);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_program_logo_text
  ON public.quick_turn_quotes(program_logo_text);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_fob
  ON public.quick_turn_quotes(fob);

COMMIT;
