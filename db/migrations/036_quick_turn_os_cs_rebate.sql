-- db/migrations/036_quick_turn_os_cs_rebate.sql
-- Adds quote-level Overseas Customer Service owner and quote rebate percentage.

BEGIN;

ALTER TABLE public.quick_turn_quotes
  ADD COLUMN IF NOT EXISTS overseas_customer_service_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overseas_customer_service_name_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS overseas_customer_service_email_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS overseas_customer_service_employee_number_snapshot integer NULL,
  ADD COLUMN IF NOT EXISTS quote_rebate_rate numeric(8,6) NOT NULL DEFAULT 0;

UPDATE public.quick_turn_quotes
SET quote_rebate_rate = 0
WHERE quote_rebate_rate IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quick_turn_quotes_quote_rebate_rate_check'
      AND conrelid = 'public.quick_turn_quotes'::regclass
  ) THEN
    ALTER TABLE public.quick_turn_quotes
      ADD CONSTRAINT quick_turn_quotes_quote_rebate_rate_check
      CHECK (quote_rebate_rate >= 0 AND quote_rebate_rate < 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qt_quotes_os_cs_user
  ON public.quick_turn_quotes(overseas_customer_service_user_id);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_rebate_rate
  ON public.quick_turn_quotes(quote_rebate_rate);

COMMIT;
