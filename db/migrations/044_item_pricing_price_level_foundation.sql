-- 044_item_pricing_price_level_foundation.sql
-- Phase 7: price-level foundation for Item Pricing Setup.
-- This adds structured internal/customer price-level setup without building customer-specific rules or quote saving.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.item_pricing_price_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NULL,
  level_type text NOT NULL DEFAULT 'INTERNAL',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  CONSTRAINT item_pricing_price_levels_level_type_chk CHECK (level_type IN ('INTERNAL', 'CUSTOMER_GROUP', 'RETAIL', 'SPECIAL'))
);

CREATE TABLE IF NOT EXISTS public.item_pricing_price_level_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_level_id uuid NOT NULL REFERENCES public.item_pricing_price_levels(id) ON DELETE CASCADE,
  rule_set_id integer NULL REFERENCES public.item_pricing_rule_sets(id),
  decoration_method_id integer NULL REFERENCES public.item_pricing_decoration_methods(id),
  quantity_break_id integer NULL REFERENCES public.item_pricing_quantity_breaks(id),
  rule_type text NOT NULL,
  multiplier numeric(12,6) NULL,
  add_amount numeric(12,4) NULL,
  percent_value numeric(12,4) NULL,
  override_price numeric(12,4) NULL,
  minimum_price numeric(12,4) NULL,
  maximum_price numeric(12,4) NULL,
  rounding_mode text NOT NULL DEFAULT 'HALF_UP_2',
  calculation_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  CONSTRAINT item_pricing_price_level_rules_rule_type_chk CHECK (rule_type IN ('MULTIPLIER', 'ADD_AMOUNT', 'DISCOUNT_PERCENT', 'OVERRIDE_PRICE', 'CODED_MULTIPLIER')),
  CONSTRAINT item_pricing_price_level_rules_rounding_chk CHECK (rounding_mode IN ('NONE', 'HALF_UP_2', 'CEILING_2', 'FLOOR_2')),
  CONSTRAINT item_pricing_price_level_rules_numbers_chk CHECK (
    (multiplier IS NULL OR multiplier >= 0)
    AND (percent_value IS NULL OR percent_value >= 0)
    AND (override_price IS NULL OR override_price >= 0)
    AND (minimum_price IS NULL OR minimum_price >= 0)
    AND (maximum_price IS NULL OR maximum_price >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_item_pricing_price_levels_active_sort
  ON public.item_pricing_price_levels(active, sort_order, code);

CREATE INDEX IF NOT EXISTS idx_item_pricing_price_level_rules_level_active
  ON public.item_pricing_price_level_rules(price_level_id, active, calculation_order);

CREATE INDEX IF NOT EXISTS idx_item_pricing_price_level_rules_scope
  ON public.item_pricing_price_level_rules(price_level_id, rule_set_id, decoration_method_id, quantity_break_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_pricing_price_level_rules_active_scope
  ON public.item_pricing_price_level_rules(
    price_level_id,
    COALESCE(rule_set_id, -1),
    COALESCE(decoration_method_id, -1),
    COALESCE(quantity_break_id, -1),
    calculation_order
  )
  WHERE active = true;

INSERT INTO public.item_pricing_price_levels (code, name, description, level_type, active, sort_order, created_by, updated_by)
VALUES
  ('INTERNAL_NET', 'Internal Net', 'Internal baseline output. No customer-specific adjustment rules are seeded.', 'INTERNAL', true, 10, 'system', 'system'),
  ('CODED', 'Coded', 'Placeholder for future coded price-list logic. Rules are intentionally not seeded yet.', 'CUSTOMER_GROUP', false, 20, 'system', 'system'),
  ('DML', 'DML', 'Placeholder for future DML customer rule logic.', 'SPECIAL', false, 30, 'system', 'system'),
  ('PRM', 'PRM', 'Placeholder for future PRM rule logic.', 'SPECIAL', false, 40, 'system', 'system'),
  ('UPA', 'UPA', 'Placeholder for future UPA rule logic.', 'SPECIAL', false, 50, 'system', 'system'),
  ('SPORTS_INC', 'Sports Inc', 'Placeholder for future Sports Inc rule logic.', 'SPECIAL', false, 60, 'system', 'system'),
  ('TOWSLEYS', 'Towsleys', 'Placeholder for future Towsleys rule logic.', 'SPECIAL', false, 70, 'system', 'system'),
  ('UNIFIRST', 'Unifirst', 'Placeholder for future Unifirst rule logic.', 'SPECIAL', false, 80, 'system', 'system'),
  ('GOLD_BOND', 'Gold Bond', 'Placeholder for future Gold Bond rule logic.', 'SPECIAL', false, 90, 'system', 'system'),
  ('RETAIL_NET', 'Retail Net', 'Placeholder for future retail net rule logic.', 'RETAIL', false, 100, 'system', 'system'),
  ('RETAIL_CODED', 'Retail Coded', 'Placeholder for future retail coded rule logic.', 'RETAIL', false, 110, 'system', 'system')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = COALESCE(public.item_pricing_price_levels.description, EXCLUDED.description),
  level_type = EXCLUDED.level_type,
  sort_order = EXCLUDED.sort_order,
  updated_at = now(),
  updated_by = 'system';
