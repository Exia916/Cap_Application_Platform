-- db/migrations/032_quick_turn_quote_lifecycle_custom_cap.sql
-- Quick Turn quote lifecycle, draft editing, revisions, custom cap snapshots,
-- workflow reference, and negative flat decoration/accessory adjustments.

BEGIN;

-- ---------------------------------------------------------------------------
-- Allow negative adjustment-style decoration/accessory setup records only.
-- Base items, camo, fees, rates, freight, DDP, rebate, tariff, surcharge, and
-- closure setup values remain non-negative through existing constraints and
-- service validation.
-- ---------------------------------------------------------------------------

ALTER TABLE public.quick_turn_accessories
  DROP CONSTRAINT IF EXISTS quick_turn_accessories_price_chk;

ALTER TABLE public.quick_turn_accessories
  ADD CONSTRAINT quick_turn_accessories_price_chk CHECK (
    unit_price >= 0
    OR (
      category = 'DECORATION'
      AND pricing_method = 'FLAT_PER_UNIT'
      AND unit_price < 0
    )
  );

ALTER TABLE public.quick_turn_quote_item_accessories
  DROP CONSTRAINT IF EXISTS quick_turn_quote_item_accessories_price_chk;

ALTER TABLE public.quick_turn_quote_item_accessories
  ADD CONSTRAINT quick_turn_quote_item_accessories_price_chk CHECK (
    (unit_price_snapshot >= 0 AND calculated_unit_price_snapshot >= 0)
    OR (
      category_snapshot = 'DECORATION'
      AND pricing_method_snapshot = 'FLAT_PER_UNIT'
      AND unit_price_snapshot < 0
      AND calculated_unit_price_snapshot < 0
    )
  );

-- ---------------------------------------------------------------------------
-- Quote lifecycle and revision tracking.
-- Existing saved quotes are backfilled as PUBLISHED because the current module
-- treats saved quotes as completed snapshots and does not support editing.
-- ---------------------------------------------------------------------------

ALTER TABLE public.quick_turn_quotes
  ADD COLUMN IF NOT EXISTS quote_status text NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS workflow_sales_order_number text NULL,
  ADD COLUMN IF NOT EXISTS source_quote_id uuid NULL REFERENCES public.quick_turn_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS published_by text NULL,
  ADD COLUMN IF NOT EXISTS published_by_user_id uuid NULL;

UPDATE public.quick_turn_quotes
SET quote_status = 'PUBLISHED'
WHERE quote_status IS NULL OR quote_status NOT IN ('DRAFT', 'PUBLISHED');

ALTER TABLE public.quick_turn_quotes
  DROP CONSTRAINT IF EXISTS quick_turn_quotes_status_chk;

ALTER TABLE public.quick_turn_quotes
  ADD CONSTRAINT quick_turn_quotes_status_chk CHECK (quote_status IN ('DRAFT', 'PUBLISHED'));

ALTER TABLE public.quick_turn_quotes
  DROP CONSTRAINT IF EXISTS quick_turn_quotes_revision_number_chk;

ALTER TABLE public.quick_turn_quotes
  ADD CONSTRAINT quick_turn_quotes_revision_number_chk CHECK (revision_number >= 0);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_status_created
  ON public.quick_turn_quotes(quote_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_source_quote
  ON public.quick_turn_quotes(source_quote_id);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_workflow_sales_order
  ON public.quick_turn_quotes(workflow_sales_order_number);

-- ---------------------------------------------------------------------------
-- Quote-specific custom cap snapshot support.
-- The normal base_item_id remains nullable, so custom caps do not need setup
-- records. Existing saved quote rows are safely marked as normal base items.
-- ---------------------------------------------------------------------------

ALTER TABLE public.quick_turn_quote_items
  ADD COLUMN IF NOT EXISTS is_custom_cap boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_cap_description_snapshot text NULL;

UPDATE public.quick_turn_quote_items
SET is_custom_cap = false
WHERE is_custom_cap IS NULL;

CREATE INDEX IF NOT EXISTS idx_qt_quote_items_custom_cap
  ON public.quick_turn_quote_items(quote_id, is_custom_cap);

COMMIT;
