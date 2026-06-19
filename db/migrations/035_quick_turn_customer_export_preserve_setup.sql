-- db/migrations/034_quick_turn_customer_export_preserve_setup.sql
-- Preserve customer-facing Quick Turn quote setup across draft recalculations/publish.
-- Customer export rows are quote-owned snapshot/config rows and should not be
-- deleted just because internal quote item snapshot ids are refreshed.

BEGIN;

DO $$
DECLARE
  fk_name text;
BEGIN
  FOR fk_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'quick_turn_quote_customer_export_items'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%quick_turn_quote_items%'
  LOOP
    EXECUTE format('ALTER TABLE public.quick_turn_quote_customer_export_items DROP CONSTRAINT IF EXISTS %I', fk_name);
  END LOOP;
END $$;

COMMENT ON COLUMN public.quick_turn_quote_customer_export_items.quote_item_id IS
  'Snapshot quote item id used for matching customer-facing export setup. No FK is enforced so selected breaks/photos survive draft snapshot refreshes and publish.';

CREATE INDEX IF NOT EXISTS idx_qt_customer_export_items_export_sort
  ON public.quick_turn_quote_customer_export_items(export_id, sort_order, quote_item_id);

COMMIT;
