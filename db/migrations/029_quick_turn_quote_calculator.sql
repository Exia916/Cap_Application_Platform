-- db/migrations/027_quick_turn_quote_calculator.sql
-- Quick Turn Quote Calculator initial schema, calculator setup, and J&F seed data.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Master / setup data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quick_turn_programs (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL
);

CREATE TABLE IF NOT EXISTS public.quick_turn_factories (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL
);

CREATE TABLE IF NOT EXISTS public.quick_turn_base_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  factory_id integer NOT NULL REFERENCES public.quick_turn_factories(id),
  item_code text NOT NULL,
  fabric_description text NULL,
  base_price numeric(12, 6) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  CONSTRAINT quick_turn_base_items_price_chk CHECK (base_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_qt_base_items_factory_active
  ON public.quick_turn_base_items(factory_id, is_active, item_code);

CREATE TABLE IF NOT EXISTS public.quick_turn_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  program_id integer NOT NULL REFERENCES public.quick_turn_programs(id),
  factory_id integer NOT NULL REFERENCES public.quick_turn_factories(id),
  category text NOT NULL,
  name text NOT NULL,
  unit_price numeric(12, 6) NOT NULL,
  pricing_method text NOT NULL,
  notes text NULL,
  input_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  CONSTRAINT quick_turn_accessories_category_chk CHECK (category IN ('DECORATION', 'CLOSURE')),
  CONSTRAINT quick_turn_accessories_price_chk CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_qt_accessories_program_factory_active
  ON public.quick_turn_accessories(program_id, factory_id, category, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.quick_turn_camo_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  factory_id integer NOT NULL REFERENCES public.quick_turn_factories(id),
  series text NOT NULL,
  supplier text NOT NULL,
  unit_price numeric(12, 6) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  CONSTRAINT quick_turn_camo_options_price_chk CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_qt_camo_factory_active
  ON public.quick_turn_camo_options(factory_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.quick_turn_calculators (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  program_id integer NOT NULL REFERENCES public.quick_turn_programs(id),
  factory_id integer NOT NULL REFERENCES public.quick_turn_factories(id),
  name text NOT NULL,
  display_label text NOT NULL,
  route_type text NOT NULL,
  duties_tax_rate numeric(8, 6) NOT NULL DEFAULT 0,
  tariff_rate numeric(8, 6) NOT NULL DEFAULT 0,
  rebate_rate numeric(8, 6) NOT NULL DEFAULT 0,
  lead_time_note text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  CONSTRAINT quick_turn_calculators_route_type_chk CHECK (route_type IN ('STANDARD', 'DDP_MO_AIR', 'DDP_DIRECT_AIR')),
  CONSTRAINT quick_turn_calculators_rate_chk CHECK (
    duties_tax_rate >= 0 AND tariff_rate >= 0 AND rebate_rate >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_qt_calculators_program_factory_active
  ON public.quick_turn_calculators(program_id, factory_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.quick_turn_calculator_breaks (
  id serial PRIMARY KEY,
  calculator_id integer NOT NULL REFERENCES public.quick_turn_calculators(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  label text NOT NULL,
  min_quantity integer NOT NULL,
  max_quantity integer NULL,
  management_review_required boolean NOT NULL DEFAULT false,
  margin_rate numeric(8, 6) NOT NULL DEFAULT 0,
  surcharge_multiplier numeric(8, 6) NOT NULL DEFAULT 1,
  air_freight_amount numeric(12, 6) NULL,
  ddp_base_amount numeric(12, 6) NULL,
  ddp_markup_rate numeric(8, 6) NULL,
  mo_shipping_amount numeric(12, 6) NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  CONSTRAINT quick_turn_calc_break_qty_chk CHECK (
    min_quantity > 0 AND (max_quantity IS NULL OR max_quantity >= min_quantity)
  ),
  CONSTRAINT quick_turn_calc_break_rates_chk CHECK (
    margin_rate >= 0
    AND surcharge_multiplier >= 0
    AND (air_freight_amount IS NULL OR air_freight_amount >= 0)
    AND (ddp_base_amount IS NULL OR ddp_base_amount >= 0)
    AND (ddp_markup_rate IS NULL OR ddp_markup_rate >= 0)
    AND (mo_shipping_amount IS NULL OR mo_shipping_amount >= 0)
  ),
  UNIQUE (calculator_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_qt_calc_breaks_calculator_active
  ON public.quick_turn_calculator_breaks(calculator_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.quick_turn_fee_types (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL
);

-- ---------------------------------------------------------------------------
-- Saved quotes and historical snapshots
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.quick_turn_quote_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS public.quick_turn_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE
    DEFAULT ('QT-' || lpad(nextval('public.quick_turn_quote_number_seq')::text, 6, '0')),
  quote_name text NOT NULL,
  program_id integer NULL REFERENCES public.quick_turn_programs(id),
  factory_id integer NULL REFERENCES public.quick_turn_factories(id),
  program_code_snapshot text NOT NULL,
  program_name_snapshot text NOT NULL,
  factory_code_snapshot text NOT NULL,
  factory_name_snapshot text NOT NULL,
  generated_at timestamptz NOT NULL,
  valid_until date NOT NULL,
  disclaimer text NOT NULL DEFAULT 'Quote pricing is valid for 30 days from the generated date and is subject to review after expiration.',
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  created_by_user_id uuid NULL,
  created_by_employee_number integer NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  updated_by_user_id uuid NULL,
  is_voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz NULL,
  voided_by text NULL,
  void_reason text NULL
);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_created_at
  ON public.quick_turn_quotes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_quote_name
  ON public.quick_turn_quotes(quote_name);

CREATE INDEX IF NOT EXISTS idx_qt_quotes_voided
  ON public.quick_turn_quotes(is_voided);

CREATE TABLE IF NOT EXISTS public.quick_turn_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quick_turn_quotes(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  base_item_id uuid NULL REFERENCES public.quick_turn_base_items(id) ON DELETE SET NULL,
  base_item_code_snapshot text NOT NULL,
  base_item_description_snapshot text NULL,
  base_item_price_snapshot numeric(12, 6) NOT NULL,
  decorated_unit_cost_snapshot numeric(12, 6) NOT NULL,
  camo_option_id uuid NULL REFERENCES public.quick_turn_camo_options(id) ON DELETE SET NULL,
  camo_code_snapshot text NULL,
  camo_series_snapshot text NULL,
  camo_supplier_snapshot text NULL,
  camo_unit_price_snapshot numeric(12, 6) NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quick_turn_quote_items_cost_chk CHECK (
    base_item_price_snapshot >= 0
    AND decorated_unit_cost_snapshot >= 0
    AND camo_unit_price_snapshot >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_qt_quote_items_quote
  ON public.quick_turn_quote_items(quote_id, sort_order);

CREATE TABLE IF NOT EXISTS public.quick_turn_quote_item_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id uuid NOT NULL REFERENCES public.quick_turn_quote_items(id) ON DELETE CASCADE,
  accessory_id uuid NULL REFERENCES public.quick_turn_accessories(id) ON DELETE SET NULL,
  category_snapshot text NOT NULL,
  accessory_code_snapshot text NOT NULL,
  accessory_name_snapshot text NOT NULL,
  pricing_method_snapshot text NOT NULL,
  unit_price_snapshot numeric(12, 6) NOT NULL,
  input_values_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_unit_price_snapshot numeric(12, 6) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quick_turn_quote_item_accessories_price_chk CHECK (
    unit_price_snapshot >= 0 AND calculated_unit_price_snapshot >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_qt_quote_item_accessories_item
  ON public.quick_turn_quote_item_accessories(quote_item_id, sort_order);

CREATE TABLE IF NOT EXISTS public.quick_turn_quote_item_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id uuid NOT NULL REFERENCES public.quick_turn_quote_items(id) ON DELETE CASCADE,
  fee_type_id integer NULL REFERENCES public.quick_turn_fee_types(id) ON DELETE SET NULL,
  fee_code_snapshot text NOT NULL,
  fee_name_snapshot text NOT NULL,
  amount_snapshot numeric(12, 2) NOT NULL,
  notes text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quick_turn_quote_item_fees_amount_chk CHECK (amount_snapshot >= 0)
);

CREATE INDEX IF NOT EXISTS idx_qt_quote_item_fees_item
  ON public.quick_turn_quote_item_fees(quote_item_id, sort_order);

CREATE TABLE IF NOT EXISTS public.quick_turn_quote_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id uuid NOT NULL REFERENCES public.quick_turn_quote_items(id) ON DELETE CASCADE,
  calculator_id integer NULL REFERENCES public.quick_turn_calculators(id) ON DELETE SET NULL,
  calculator_code_snapshot text NOT NULL,
  calculator_name_snapshot text NOT NULL,
  calculator_route_type_snapshot text NOT NULL,
  quantity_break_id integer NULL REFERENCES public.quick_turn_calculator_breaks(id) ON DELETE SET NULL,
  break_label_snapshot text NOT NULL,
  min_quantity_snapshot integer NOT NULL,
  max_quantity_snapshot integer NULL,
  management_review_required_snapshot boolean NOT NULL DEFAULT false,
  margin_rate_snapshot numeric(8, 6) NOT NULL,
  surcharge_multiplier_snapshot numeric(8, 6) NOT NULL,
  duties_tax_rate_snapshot numeric(8, 6) NOT NULL,
  tariff_rate_snapshot numeric(8, 6) NOT NULL,
  rebate_rate_snapshot numeric(8, 6) NOT NULL,
  air_freight_amount_snapshot numeric(12, 6) NULL,
  ddp_base_amount_snapshot numeric(12, 6) NULL,
  ddp_markup_rate_snapshot numeric(8, 6) NULL,
  mo_shipping_amount_snapshot numeric(12, 6) NULL,
  surcharged_decorated_cost_snapshot numeric(12, 6) NOT NULL,
  camo_unit_price_snapshot numeric(12, 6) NOT NULL DEFAULT 0,
  pre_margin_cost_snapshot numeric(12, 6) NOT NULL,
  unit_price_snapshot numeric(12, 6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quick_turn_quote_results_unit_price_chk CHECK (unit_price_snapshot >= 0)
);

CREATE INDEX IF NOT EXISTS idx_qt_quote_results_item
  ON public.quick_turn_quote_results(quote_item_id, calculator_code_snapshot, min_quantity_snapshot);

-- ---------------------------------------------------------------------------
-- Seed Phase 1 setup
-- ---------------------------------------------------------------------------

INSERT INTO public.quick_turn_programs (code, name, description, sort_order, is_active)
VALUES ('QUICK_TURN', 'Quick Turn', 'Quick Turn quote program', 10, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.quick_turn_factories (code, name, sort_order, is_active)
VALUES ('JF', 'J&F', 10, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.quick_turn_calculators (
  code,
  program_id,
  factory_id,
  name,
  display_label,
  route_type,
  duties_tax_rate,
  tariff_rate,
  rebate_rate,
  lead_time_note,
  sort_order,
  is_active
)
VALUES
  (
    'STANDARD_QT',
    (SELECT id FROM public.quick_turn_programs WHERE code = 'QUICK_TURN'),
    (SELECT id FROM public.quick_turn_factories WHERE code = 'JF'),
    'Standard QT',
    'Standard QT',
    'STANDARD',
    0.085,
    0.35,
    0,
    '5-8 DAYS FOR SAMPLE PHOTOS / 21 DAYS PRODUCTION / 5-7 DAYS TO DELIVER TO FINAL DESTINATION / ALL TOGETHER 30-35 DAYS ESTIMATED',
    10,
    true
  ),
  (
    'DDP_MO_AIR_QT',
    (SELECT id FROM public.quick_turn_programs WHERE code = 'QUICK_TURN'),
    (SELECT id FROM public.quick_turn_factories WHERE code = 'JF'),
    'DDP MO Air QT',
    'DDP MO Air QT — Includes MO to Final Destination Shipping',
    'DDP_MO_AIR',
    0,
    0,
    0,
    '5-7 DAYS FOR PHOTOS / 21 DAYS FOR PRODUCTION / 7 DAYS FOR CONSOLIDATION TO CAP A / 10 DAYS FOR DELIVERY TO FINAL DESTINATION / 40-45 DAYS ALL TOGETHER',
    20,
    true
  ),
  (
    'DDP_DIRECT_AIR_QT',
    (SELECT id FROM public.quick_turn_programs WHERE code = 'QUICK_TURN'),
    (SELECT id FROM public.quick_turn_factories WHERE code = 'JF'),
    'DDP Direct Air QT',
    'DDP Direct Air QT',
    'DDP_DIRECT_AIR',
    0,
    0,
    0,
    '5-7 DAYS FOR PHOTOS / 21 DAYS FOR PRODUCTION / 7-10 DAYS FOR DELIVERY TO FINAL DESTINATION / 30-35 DAYS ALL TOGETHER',
    30,
    true
  )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    display_label = EXCLUDED.display_label,
    route_type = EXCLUDED.route_type,
    duties_tax_rate = EXCLUDED.duties_tax_rate,
    tariff_rate = EXCLUDED.tariff_rate,
    rebate_rate = EXCLUDED.rebate_rate,
    lead_time_note = EXCLUDED.lead_time_note,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.quick_turn_calculator_breaks (
  calculator_id,
  sort_order,
  label,
  min_quantity,
  max_quantity,
  management_review_required,
  margin_rate,
  surcharge_multiplier,
  air_freight_amount,
  ddp_base_amount,
  ddp_markup_rate,
  mo_shipping_amount,
  is_active
)
SELECT
  c.id,
  v.sort_order,
  v.label,
  v.min_quantity,
  v.max_quantity,
  v.management_review_required,
  v.margin_rate,
  v.surcharge_multiplier,
  v.air_freight_amount,
  v.ddp_base_amount,
  v.ddp_markup_rate,
  v.mo_shipping_amount,
  v.is_active
FROM (
VALUES
  ('STANDARD_QT', 1, '1–72', 1, 72, false, 0.43, 1.5, 2.9, NULL, NULL, NULL, true),
  ('STANDARD_QT', 2, '73–144', 73, 144, false, 0.45, 1.35, 2.25, NULL, NULL, NULL, true),
  ('STANDARD_QT', 3, '145–300', 145, 300, false, 0.41, 1.25, 1.75, NULL, NULL, NULL, true),
  ('STANDARD_QT', 4, '301–576', 301, 576, false, 0.41, 1.2, 1.7, NULL, NULL, NULL, true),
  ('STANDARD_QT', 5, '577–1008', 577, 1008, false, 0.36, 1.2, 1.65, NULL, NULL, NULL, true),
  ('STANDARD_QT', 6, '1009–2508', 1009, 2508, false, 0.3, 1.2, 1.65, NULL, NULL, NULL, true),
  ('STANDARD_QT', 7, '2509–5004', 2509, 5004, false, 0.3, 1.2, 1.42, NULL, NULL, NULL, true),
  ('STANDARD_QT', 8, '5005–10008+', 5005, 10008, true, 0.27, 1.15, 1.21, NULL, NULL, NULL, true),
  ('DDP_MO_AIR_QT', 1, '1–72', 1, 72, false, 0.43, 1.5, NULL, 2.18, 0.25, 0.25, true),
  ('DDP_MO_AIR_QT', 2, '73–144', 73, 144, false, 0.45, 1.35, NULL, 2.18, 0.25, 0.25, true),
  ('DDP_MO_AIR_QT', 3, '145–300', 145, 300, false, 0.41, 1.25, NULL, 2.18, 0.25, 0.25, true),
  ('DDP_MO_AIR_QT', 4, '301–576', 301, 576, false, 0.41, 1.2, NULL, 2.18, 0.25, 0.25, true),
  ('DDP_MO_AIR_QT', 5, '577–1008', 577, 1008, false, 0.36, 1.2, NULL, 2.18, 0.25, 0.25, true),
  ('DDP_MO_AIR_QT', 6, '1009–2508', 1009, 2508, false, 0.28, 1.2, NULL, 2.18, 0.25, 0.25, true),
  ('DDP_MO_AIR_QT', 7, '2509–5004', 2509, 5004, false, 0.3, 1.2, NULL, 1.94, 0.25, 0.25, true),
  ('DDP_MO_AIR_QT', 8, '5005–10008+', 5005, 10008, true, 0.27, 1.15, NULL, 1.85, 0.25, 0.25, true),
  ('DDP_DIRECT_AIR_QT', 1, '1–72', 1, 72, false, 0.43, 1.5, NULL, 3.0, 0.25, NULL, true),
  ('DDP_DIRECT_AIR_QT', 2, '73–144', 73, 144, false, 0.45, 1.35, NULL, 3.0, 0.25, NULL, true),
  ('DDP_DIRECT_AIR_QT', 3, '145–300', 145, 300, false, 0.41, 1.25, NULL, 3.0, 0.25, NULL, true),
  ('DDP_DIRECT_AIR_QT', 4, '301–576', 301, 576, false, 0.41, 1.2, NULL, 3.0, 0.25, NULL, true),
  ('DDP_DIRECT_AIR_QT', 5, '577–1008', 577, 1008, false, 0.36, 1.2, NULL, 3.0, 0.25, NULL, true),
  ('DDP_DIRECT_AIR_QT', 6, '1009–2508', 1009, 2508, false, 0.28, 1.2, NULL, 3.0, 0.25, NULL, true),
  ('DDP_DIRECT_AIR_QT', 7, '2509–5004', 2509, 5004, false, 0.3, 1.2, NULL, 3.0, 0.25, NULL, true),
  ('DDP_DIRECT_AIR_QT', 8, '5005–10008+', 5005, 10008, true, 0.27, 1.15, NULL, 3.0, 0.25, NULL, true)
) AS v(
  calculator_code,
  sort_order,
  label,
  min_quantity,
  max_quantity,
  management_review_required,
  margin_rate,
  surcharge_multiplier,
  air_freight_amount,
  ddp_base_amount,
  ddp_markup_rate,
  mo_shipping_amount,
  is_active
)
JOIN public.quick_turn_calculators c ON c.code = v.calculator_code
ON CONFLICT (calculator_id, sort_order) DO UPDATE
SET label = EXCLUDED.label,
    min_quantity = EXCLUDED.min_quantity,
    max_quantity = EXCLUDED.max_quantity,
    management_review_required = EXCLUDED.management_review_required,
    margin_rate = EXCLUDED.margin_rate,
    surcharge_multiplier = EXCLUDED.surcharge_multiplier,
    air_freight_amount = EXCLUDED.air_freight_amount,
    ddp_base_amount = EXCLUDED.ddp_base_amount,
    ddp_markup_rate = EXCLUDED.ddp_markup_rate,
    mo_shipping_amount = EXCLUDED.mo_shipping_amount,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.quick_turn_fee_types (code, name, description, sort_order, is_active)
VALUES
  ('MOLD_FEE', 'Mold Fee', 'One-time mold fee; shown separately and does not affect unit price.', 10, true),
  ('OTHER', 'Other', 'Other one-time fee; shown separately and does not affect unit price.', 90, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.quick_turn_base_items (
  code,
  factory_id,
  item_code,
  fabric_description,
  base_price,
  sort_order,
  is_active
)
SELECT
  v.code,
  f.id,
  v.item_code,
  v.fabric_description,
  v.base_price,
  v.sort_order,
  v.is_active
FROM (
VALUES
  ('I8505', 'JF', 'i8505', 'Constructured low profile 6 panels cap
TC cotton twill (65% polyester/35% cotton)', 1.5750000000000002, 10, true),
  ('I8505Y', 'JF', 'i8505Y', 'Constructured low profile 6 panels cap
TC cotton twill (65% polyester/35% cotton)', 1.55, 20, true),
  ('I8507_WOODLAND', 'JF', 'i8507-WOODLAND', 'Bucket hat
size:61CM', 4.496666666666666, 30, true),
  ('I8507', 'JF', 'i8507', 'Bucket hat
size:61CM', 3.8491666666666666, 40, true),
  ('I8518', 'JF', 'i8518', 'Constructured med profile 6 panel cap                                                                heather 
65% polyester /30% rayon/5% spandex/ trucker mesh 137g/m2 300D*300D Hard mesh (100% polyester)', 1.74, 50, true),
  ('I8527', 'JF', 'i8527', 'Unstructured 16*12 scratching cotton twill,back  soft mesh ,dirty wash', 2.040833333333333, 60, true),
  ('I8540', 'JF', 'i8540', 'Constructured med profile 5 panels cap  
Cavalry Incline
96% Poly/4% Spandex
-65/35 Poly Cotton Blend
Perforated panels', 3.966666666666667, 70, true),
  ('I3005', 'JF', 'i3005', '20*20 cotton twill with mesh', 1.369, 80, true),
  ('I3025', 'JF', 'i3025', '20X20  cotton flat twill/mesh', 1.369, 90, true),
  ('I5000_AUDULT', 'JF', 'I5000 Audult', '20*20 Lt. brushed cotton twill(lighgt weight)', 1.39, 100, true),
  ('I5000YOUTH', 'JF', 'I5000Youth', '20*20 Lt. brushed cotton twill(lighgt weight)', 1.39, 110, true),
  ('I5002', 'JF', 'i5002', '100% Polyester', 1.18, 120, true),
  ('I5003', 'JF', 'i5003', '100% Polyester with mesh', 1.2412500000000002, 130, true),
  ('I5005', 'JF', 'i5005', '20*20 Lt. brushed cotton twill,unstructured', 1.3375000000000001, 140, true),
  ('I5010', 'JF', 'i5010', '20*20 Lt. brushed cotton twill(lighgt weight)', 1.39, 150, true),
  ('I5015', 'JF', 'i5015', '20*20 Lt. brushed cotton twill(lighgt weight)', 1.4425000000000001, 160, true),
  ('I5030', 'JF', 'i5030', '20*20 Lt. brushed cotton twill(lighgt weight)', 1.474, 170, true),
  ('I5050', 'JF', 'i5050', '20*20 Flat Cotton twill(lighgt weight)', 1.39, 180, true),
  ('ITV', 'JF', 'ITV', '20*20 Flat Cotton twill(lighgt weight)', 1.4425000000000001, 190, true),
  ('I1000', 'JF', 'i1000', 'Washed Chino twill(16*10/108*56)', 1.4749999999999999, 200, true),
  ('I1002', 'JF', 'i1002', 'Washed Chino twill(16*10/108*56)', 1.555, 210, true),
  ('I1003', 'JF', 'i1003', '16*10 cotton twill', 1.425, 220, true),
  ('I1004', 'JF', 'i1004', '16*10 cotton twill', 2.0749999999999997, 230, true),
  ('I1006', 'JF', 'i1006', '100% polyester twill', 1.125, 240, true),
  ('I1011', 'JF', 'i1011', 'Chino twill(16*10/108*56) with  mesh back', 1.625, 250, true),
  ('I1012', 'JF', 'i1012', '85/15 wool blend', 2.335, 260, true),
  ('I1020', 'JF', 'i1020', 'Washed Chino twill(16*10/108*56)', 1.6050000000000002, 270, true),
  ('I1023', 'JF', 'i1023', '16*10 cotton twill', 1.675, 280, true),
  ('I1024', 'JF', 'i1024', '16*10 heavy washed chino twill', 2.025, 290, true),
  ('I1027', 'JF', 'i1027', '16*10 washed chino twill / mesh', 2.0566666666666666, 300, true),
  ('I1028', 'JF', 'i1028', '16*10 bushed cotton twill', 2.09, 310, true),
  ('I1070', 'JF', 'i1070', '10*10 Heavy brushed cotton twill', 1.4416666666666667, 320, true),
  ('I1076', 'JF', 'i1076', 'Chino twiil /trucker mesh', 1.7249999999999999, 330, true),
  ('I1078', 'JF', 'i1078', 'Contructured low profile 6 panel cap                                                                                      100% polyester/reflective', 1.6083333333333334, 340, true),
  ('I2011_NAVY', 'JF', 'i2011/NAVY', 'Contructured low profile 6 panel cap                          
Chino twill/ trucker mesh with print', 1.7750000000000001, 350, true),
  ('I2012', 'JF', 'i2012', 'Constructured low profile 6 panels cap
chino twill  with air mesh', 1.745, 360, true),
  ('I2014', 'JF', 'i2014', 'Constructured low profile 6 panel cap
ottoman fabric/mesh', 2.414166666666667, 370, true),
  ('I3007', 'JF', 'i3007', 'Constructured low profile 6 panel cap                                                               16*12 Recycled CVC Twill 60% cotton/40% recycled poly(CAP AMERICA supply the REPREVE hangtag)', 2.0866666666666664, 380, true),
  ('I3010', 'JF', 'i3010', '16*12 Medium brushed cotton twill', 1.5350000000000001, 390, true),
  ('I3015', 'JF', 'i3015', '16*12 Medium brushed cotton twill', 1.4416666666666667, 400, true),
  ('I3016', 'JF', 'i3016', 'Safety 100% Polyester twill /Reflective Piping', 1.875, 410, true),
  ('I3019', 'JF', 'i3019', 'Washed coated fabric/16*10 chino twill', 2.191666666666667, 420, true),
  ('I3026', 'JF', 'i3026', 'Washed pigment dyed cotton twill(16*12)', 1.5750000000000002, 430, true),
  ('I3027', 'JF', 'i3027', 'Washed pigment dyed cotton twill(16*12) with soft mesh back', 1.425, 440, true),
  ('I3028', 'JF', 'i3028', 'Contructured medium profile 6 panel cap                          
Chino twill/ trucker mesh', 1.5999999999999999, 450, true),
  ('I3032', 'JF', 'i3032', 'Unstructured scratching slub canvas,back  soft mesh ,enzymewash', 1.9649999999999999, 460, true),
  ('I3034', 'JF', 'i3034', 'Constructured low profile 6 panels cap
chino twill', 1.4749999999999999, 470, true),
  ('I3036', 'JF', 'i3036', 'Structured,Canvas with trucker mesh', 1.4350000000000003, 480, true),
  ('I3038', 'JF', 'i3038', 'Constructured med profile 6 panel cap                                                        108*58 , 21x 21 65% poly,35% cotton /mesh', 1.635, 490, true),
  ('I3047', 'JF', 'i3047', 'Constructured med profile 5 panels cap
25%rayon/2%spandex/73%polyester/mesh', 1.4749999999999999, 500, true),
  ('I3050', 'JF', 'i3050', '16*10 cotton twill /mesh', 1.4749999999999999, 510, true),
  ('I3055', 'JF', 'i3055', '16*10 cotton twill/mesh', 1.425, 520, true),
  ('I3060', 'JF', 'i3060', '16*10 cotton twill', 1.665, 530, true),
  ('I3115', 'JF', 'i3115', 'Constructured med profile 6 panels cap
chino twill/mesh', 1.425, 540, true),
  ('I3115_HTR_SEABLUE_STONE', 'JF', 'i3115-HTR/SEABLUE/STONE', 'Constructured med profile 6 panels cap
wool blend/mesh', 1.5250000000000001, 550, true),
  ('I3115Y', 'JF', 'I3115Y', 'Constructured med profile 6 panels cap
chino twill/mesh,YOUTH', 1.4000000000000001, 560, true),
  ('I3115XS', 'JF', 'i3115XS', 'Constructured med profile 6 panel cap
chino twill/mesh
new color for i3115Y', 1.4000000000000001, 570, true),
  ('I900', 'JF', 'i900', '16*12 Medium brushed cotton twill', 1.4749999999999999, 580, true),
  ('I9040', 'JF', 'i9040', '16*10 cotton twill with liquid metal tread plate', 2.025, 590, true),
  ('I3056', 'JF', 'i3056', 'Structured 
Med profile --K63
 5 panels ,
Perforated panels ,
DF Sweatband 
  T4 21*21 Poly-span    
100% polyester', 2.125, 600, true),
  ('I3068', 'JF', 'i3068', 'Structured 
high profile 
5 panels cap-K5
Modified flat bill
21*21T/C 65%polyester 35%Cotton', 1.4749999999999999, 610, true),
  ('I3021', 'JF', 'i3021', 'Constructured 
High profile-K5 
5 panels cap  ,mesh back cap                                                11 Whale 100% polyester  Corduroy', 1.5250000000000001, 620, true),
  ('I7012', 'JF', 'i7012', '20*16 bushed with spandex', 2.015, 630, true),
  ('I7017', 'JF', 'i7017', '16*10 cotton twill with sandwich mesh', 1.625, 640, true),
  ('I7018', 'JF', 'i7018', '16*10 cotton twill/sandwich mesh', 1.9749999999999999, 650, true),
  ('I7024', 'JF', 'i7024', 'Soft bead mesh(quick dry/uv guard)', 1.6033333333333335, 660, true),
  ('I7025', 'JF', 'i7025', '16*10 with doubel layer mesh', 1.625, 670, true),
  ('I7034', 'JF', 'i7034', 'Constructured low profile 6 panels cap
93% Polyester 7%Spandex heather fabric with stretchbale mesh,5026 Oxford buckram', 2.335, 680, true),
  ('I7035', 'JF', 'i7035', '100% polyester football pattern(quick dry/uv guard)', 1.6233333333333333, 690, true),
  ('I7036', 'JF', 'i7036', 'Contructured low profile 6 panel cap                          
  soft bead mesh(quick dry)
size:L/XL,S/M', 1.9233333333333331, 700, true),
  ('I7037', 'JF', 'i7037', 'Constructured low profile 6 panels cap
93% Polyester 7%Spandex heather fabric with truck mesh,silicon velcro,5026 Oxford buckram', 1.6633333333333333, 710, true),
  ('I7039', 'JF', 'i7039', 'Constructured low profile 6 panels cap
 heather fabric with stretchbale mesh,silicon velcro', 2.185, 720, true),
  ('I7045', 'JF', 'i7045', 'Constructured low profile 6 panel cap                                                               : 95 % Poly/5% Spendex
WL-2069 Heather Spandex', 2.195, 730, true),
  ('I7256', 'JF', 'i7256', '100% Polyester pongee ( match i8507 fabric)/Fushia #28,MW +UV guard
WHITE ROPE', 2.35, 740, true),
  ('I7041', 'JF', 'i7041', '100% polyester Aerated Ripstop ,  UV and Moisture wicking properties', 2.5833333333333335, 750, true),
  ('I7042', 'JF', 'i7042', ',100% Lightweight Polyester football pattern UV and moisture wicking,sunvisor', 1.705, 760, true),
  ('I2005', 'JF', 'i2005', 'Cap America supply Licenced camo(fabric yield 0.82yds/dz)', 1.0999999999999999, 770, true),
  ('I2005_BLAZE_BLAZE', 'JF', 'i2005 blaze/blaze', NULL, 1.425, 780, true),
  ('I2006', 'JF', 'i2006', 'Cap America supply Licenced camo(fabric yield 0.82yds/dz,mesh yield 0.75yds/dz)', 1.055, 790, true),
  ('I2008', 'JF', 'i2008', 'Washed Chino twill(16*10/108*56) camo print with soft mesh', 1.5750000000000002, 800, true),
  ('I2011_AP', 'JF', 'i2011/AP', 'Contructured low profile 6 panel cap                          
Realtree AP/ trucker mesh with print ,fabric yield 1.25yds/d', 1.5750000000000002, 810, true),
  ('I2015', 'JF', 'i2015', '65% Polyester 35% Cotton digital camo', 1.465, 820, true),
  ('I2018', 'JF', 'i2018', 'Washed coated fabric/Cap America supply Licenced camo(fabric yield 0.8yds/dz)', 1.825, 830, true),
  ('I2019', 'JF', 'i2019', 'Contructured low profile 6 panel cap                                                                                      100% polyester', 1.7208333333333332, 840, true),
  ('I2025', 'JF', 'i2025', '16*10 cotton twill /Cap America supply Licenced camo(fabric yield 1.35yds/dz)', 1.325, 850, true),
  ('I2027', 'JF', 'i2027', 'Cap America supply Licenced camo washed(fabric yield 1.36yds/dz)/mesh', 1.3950000000000002, 860, true),
  ('I2030_ADULT', 'JF', 'i2030 ADULT', 'Cap America supply Licenced camo(fabric yield 1.55yds/dz)', 1.0250000000000001, 870, true),
  ('I2030_BLAZE', 'JF', 'i2030 BLAZE', NULL, 1.4749999999999999, 880, true),
  ('I2030YOUTH', 'JF', 'i2030Youth', NULL, 1.0250000000000001, 890, true),
  ('I2030T', 'JF', 'i2030T', 'Cap America supply Licenced camo(fabric yield 1.40yds/dz)', 1.075, 900, true),
  ('I2031', 'JF', 'i2031', 'Cap America supply Licenced camo(fabric yield 1.55yds/dz)', 1.0250000000000001, 910, true),
  ('I2032', 'JF', 'i2032', 'ORANGE RIDGE CAMO,                                                                                       
100% polyester', 1.375, 920, true),
  ('I2034', 'JF', 'i2034', '100% polyester & trucker mesh', 1.325, 930, true),
  ('I2055', 'JF', 'i2055', 'canvas with flet twill visor', 1.5250000000000001, 940, true),
  ('I2065', 'JF', 'i2065', 'NEXT CAMO                                                     Cap America supply Licenced camo(fabric yield 1.55yds/dz)', 1.0250000000000001, 950, true),
  ('I2067', 'JF', 'i2067', 'NEXT CAMO,                                                          Cap America supply Licenced camo(fabric yield 0.82yds/dz)', 1.0999999999999999, 960, true),
  ('I2068', 'JF', 'i2068', 'BLK/NEXT CAMO,                                                 16*10 cotton twill /Cap America supply Licenced camo(fabric yield 1.35yds/dz)', 1.2650000000000001, 970, true),
  ('I2068_BLAZE', 'JF', 'i2068        blaze', 'BLAZE/NEXT CAMO,                                           Cap America supply Licenced camo
(fabric yield:1.35yds/dz)', 1.385, 980, true),
  ('I2070', 'JF', 'i2070', 'Cap America supply Licenced camo(fabric yield 0.36yds/dz,mesh yield 0.95yds/dz)', 1.2650000000000001, 990, true),
  ('I2075', 'JF', 'i2075', 'Cap America supply Licenced camo(fabric yield 0.65yds/dz)', 1.245, 1000, true),
  ('I2079', 'JF', 'i2079', 'Blaze/realtree ap,                                                    Cap America supply Licenced camo 
(fabric yield:0.95yds/dz)', 1.625, 1010, true),
  ('I2089', 'JF', 'i2089', 'Realtree ap/chino twill,                                        Cap America supply Licenced camo 
(fabric yield:0.8yds/dz)', 1.325, 1020, true),
  ('I3008', 'JF', 'i3008', 'Cap America supply Licenced camo(fabric yield 0.9yds/dz)', 1.5091666666666665, 1030, true),
  ('I3008_BLAZE', 'JF', 'i3008 blaze', 'Cap America supply Licenced camo(fabric yield 0.9yds/dz)', 1.5091666666666665, 1040, true),
  ('I2024', 'JF', 'i2024', 'Constructured med profile 6 panel cap
Camo Nylon Spandex KT22001C
75%Polyamide fiber, 25% spandex 225/grams/Black #1,
Double mesh 100% polyester/Black', 2.475, 1050, true),
  ('I3007_HEATHER', 'JF', 'I3007-HEATHER', 'Constructured low profile 6 panel cap
21*21 100% recycled polyester Unify Repreve fabric-
210g/heather Gray
i3007(CAP AMERICA supply the REPREVE hangtag)', 2.125, 1060, true),
  ('I7266', 'JF', 'i7266', '6 panel -i7256-K45 Shape,100% Polyester
Black DF sweatband', 2.341666666666667, 1070, true),
  ('I3039', 'JF', 'i3039', '108*58,21×21 65%Polyester35%Cotton
300D*300D 100%Polyester 
Trucker Mesh', 1.635, 1080, true),
  ('I2026', 'JF', 'i2026', 'JF 84C:195g/m2
97% Polyester 
3% Spandex,Full sublimation
DF Sweatband', 2.566666666666667, 1090, true),
  ('I2026_2', 'JF', 'i2026', 'JF 84C:195g/m2
97% Polyester 
3% Spandex,visor sublimation
DF Sweatband', 2.4, 1100, true)
) AS v(code, factory_code, item_code, fabric_description, base_price, sort_order, is_active)
JOIN public.quick_turn_factories f ON f.code = v.factory_code
ON CONFLICT (code) DO UPDATE
SET factory_id = EXCLUDED.factory_id,
    item_code = EXCLUDED.item_code,
    fabric_description = EXCLUDED.fabric_description,
    base_price = EXCLUDED.base_price,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.quick_turn_accessories (
  code,
  program_id,
  factory_id,
  category,
  name,
  unit_price,
  pricing_method,
  notes,
  input_config,
  sort_order,
  is_active
)
SELECT
  v.code,
  p.id,
  f.id,
  v.category,
  v.name,
  v.unit_price,
  v.pricing_method,
  v.notes,
  v.input_config,
  v.sort_order,
  v.is_active
FROM (
VALUES
  ('FLAT_EMBROIDERY', 'QUICK_TURN', 'JF', 'DECORATION', 'Flat embroidery', 0.04, 'PER_1000_STITCHES', 'Per 1000 Stitches so will need to expose a field to capture stitch count if chosen.', '{"requiresStitchCount":true}'::jsonb, 10, true),
  ('3_D_EMBROIDERY', 'QUICK_TURN', 'JF', 'DECORATION', '3-D embroidery', 0.06, 'PER_1000_STITCHES', 'Per 1000 Stitches so will need to expose a field to capture stitch count if chosen.', '{"requiresStitchCount":true}'::jsonb, 20, true),
  ('FLAT_METALLIC_EMBROIDERY', 'QUICK_TURN', 'JF', 'DECORATION', 'Flat Metallic embroidery', 0.05, 'PER_1000_STITCHES', 'Per 1000 Stitches so will need to expose a field to capture stitch count if chosen.', '{"requiresStitchCount":true}'::jsonb, 30, true),
  ('METALLIC_EMBROIDERY', 'QUICK_TURN', 'JF', 'DECORATION', 'Metallic embroidery', 0.1, 'PER_1000_STITCHES', 'Per 1000 Stitches so will need to expose a field to capture stitch count if chosen.', '{"requiresStitchCount":true}'::jsonb, 40, true),
  ('FELT_APPLIQUE', 'QUICK_TURN', 'JF', 'DECORATION', 'Felt applique', 0.092, 'BASE_PLUS_EMBROIDERY_STITCHES', 'Need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add this stitch cost to this price.', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 50, true),
  ('TWILL_APPLIQUE', 'QUICK_TURN', 'JF', 'DECORATION', 'Twill applique', 0.092, 'BASE_PLUS_EMBROIDERY_STITCHES', 'Need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add this stitch cost to this price.', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 60, true),
  ('TO_APPLY_APPLIQUE', 'QUICK_TURN', 'JF', 'DECORATION', 'To apply applique', 0.091, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 70, true),
  ('PRINTED_APPLIQUE', 'QUICK_TURN', 'JF', 'DECORATION', 'Printed applique', 0.06, 'PRINTED_APPLIQUE', 'Will need to expose a field to capture quantity of colors if chosen. This price is per color. Add the "To apply applique" charge to total.', '{"requiresColorCount":true}'::jsonb, 80, true),
  ('FRAYED_APPLIQUE', 'QUICK_TURN', 'JF', 'DECORATION', 'Frayed applique', 0.092, 'BASE_PLUS_EMBROIDERY_STITCHES', 'Need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add this stitch cost to this price.', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 90, true),
  ('DIRECT_SCREENPRINT', 'QUICK_TURN', 'JF', 'DECORATION', 'Direct screenprint', 0.06, 'PER_PANEL_PER_COLOR', 'Per single panel or applique and color. Will need to expose a field to capture quantity of panels and quantity of colors if chosen.', '{"requiresPanelCount":true,"requiresColorCount":true}'::jsonb, 100, true),
  ('WATER_BASED_PRINT', 'QUICK_TURN', 'JF', 'DECORATION', 'Water based print', 0.06, 'PER_PANEL_PER_COLOR', 'Per single panel or applique and color. Will need to expose a field to capture quantity of panels and quantity of colors if chosen.', '{"requiresPanelCount":true,"requiresColorCount":true}'::jsonb, 110, true),
  ('DESTRESSED_PRINT', 'QUICK_TURN', 'JF', 'DECORATION', 'Destressed print', 0.06, 'PER_PANEL_PER_COLOR', 'Per single panel or applique and color. Will need to expose a field to capture quantity of panels and quantity of colors if chosen.', '{"requiresPanelCount":true,"requiresColorCount":true}'::jsonb, 120, true),
  ('SUBLIMATION', 'QUICK_TURN', 'JF', 'DECORATION', 'Sublimation', 0.4, 'PER_PANEL', 'Per Panel. Will need to expose a panel field to capture quantity if chosen.', '{"requiresPanelCount":true}'::jsonb, 130, true),
  ('FABRIC_SUBLIMATION', 'QUICK_TURN', 'JF', 'DECORATION', 'Fabric Sublimation', 0.666666666666667, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 140, true),
  ('WOVEN_APPLIQUE_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Woven applique (less than 5cm)', 0.233, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 150, true),
  ('WOVEN_APPLIQUE_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Woven applique (5-10cm)', 0.317, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 160, true),
  ('PIPING_ON_VISOR', 'QUICK_TURN', 'JF', 'DECORATION', 'Piping on visor', 0.05, 'PER_ROW', ' Cost per row of piping. Will need to expose a Piping Number field if chosen.', '{"requiresRowCount":true}'::jsonb, 170, true),
  ('FABRIC_INSERT', 'QUICK_TURN', 'JF', 'DECORATION', 'Fabric insert', 0.042, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 180, true),
  ('PU_LEATHER_PATCH_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'PU leather patch (less than 5cm)', 0.2, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 190, true),
  ('PU_LEATHER_PATCH_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'PU leather patch (5-10cm)', 0.35, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 200, true),
  ('MERROWED_EDGE_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Merrowed edge (less than 5cm)', 0.1, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 210, true),
  ('MERROWED_EDGE_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Merrowed edge (5-10cm)', 0.133, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 220, true),
  ('WOVEN_BADGE_EMBLEM_WITH_MERROWED_EDGE_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Woven  badge/emblem with merrowed edge (less than 5cm)', 0.233, 'FLAT_WITH_MERROWED', 'If chosen also add the price for Merrowed edge (less than 5cm) to this price.', '{}'::jsonb, 230, true),
  ('WOVEN_BADGE_EMBLEM_WITH_MERROWED_EDGE_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Woven  badge/emblem with merrowed edge (5-10cm)', 0.317, 'FLAT_WITH_MERROWED', 'If chosen also add the price for Merrowed edge (5-10cm) to this price.', '{}'::jsonb, 240, true),
  ('EMBROIDERY_PATCH_WITH_MERROWED_EDGE_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Embroidery patch with merrowed edge (less than 5cm)', 0.092, 'EMBROIDERY_WITH_MERROWED_AND_STITCHES', 'If chosen also add the price for Merrowed edge (less than 5cm) to this price. Will also need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add this stitch cost to this price.', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 250, true),
  ('EMBROIDERY_PATCH_WITH_MERROWED_EDGE_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Embroidery patch with merrowed edge (5-10cm)', 0.092, 'EMBROIDERY_WITH_MERROWED_AND_STITCHES', 'If chosen also add the price for Merrowed edge (5-10cm) to this price. Will also need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add this stitch cost to this price.', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 260, true),
  ('PRINTED_PATCH_WITH_MERROWED_EDGE_EMBLEM_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Printed patch with merrowed edge emblem (less than 5cm)', 0.06, 'PRINTED_PATCH_WITH_MERROWED', 'Will need to expose a field to capture quantity of colors if chosen. This price is per color. Add the "To apply applique" charge to total. If chosen also add the price for Merrowed edge (less than 5cm) to this price.', '{"requiresColorCount":true}'::jsonb, 270, true),
  ('PRINTED_PATCH_WITH_MERROWED_EDGE_EMBLEM_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Printed patch with merrowed edge emblem (5-10cm)', 0.06, 'PRINTED_PATCH_WITH_MERROWED', 'Will need to expose a field to capture quantity of colors if chosen. This price is per color. Add the "To apply applique" charge to total. If chosen also add the price for Merrowed edge (5-10cm) to this price.', '{"requiresColorCount":true}'::jsonb, 280, true),
  ('EMBROIDERY_BADGE_EMBLEM_WITH_EMBROIDERED_EDGE', 'QUICK_TURN', 'JF', 'DECORATION', 'Embroidery badge/emblem with Embroidered Edge', 0.092, 'BASE_PLUS_EMBROIDERY_STITCHES', 'Need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add this stitch cost to this price.', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 290, true),
  ('WOVEN_BADGE_EMBLEM_WITH_EMBROIDERED_EDGE_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Woven badge/emblem with embroidered edge (less than 5cm)', 0.233, 'BASE_PLUS_EMBROIDERY_STITCHES', 'Need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add this stitch cost to this price. ', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 300, true),
  ('WOVEN_BADGE_EMBLEM_WITH_EMBROIDERED_EDGE_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'Woven badge/emblem with embroidered edge (5-10cm)', 0.317, 'BASE_PLUS_EMBROIDERY_STITCHES', 'Need to be able to choose "Flat Embroidery" or "3-D Embroidery" and enter the stitch count to add the stitch cost to this price. ', '{"requiresStitchCount":true,"requiresEmbroideryType":true,"embroideryTypes":["FLAT_EMBROIDERY","THREE_D_EMBROIDERY"]}'::jsonb, 310, true),
  ('DIRTY_WASH', 'QUICK_TURN', 'JF', 'DECORATION', 'Dirty wash', 0.542, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 320, true),
  ('BRAIDED_ROPE_IN_BLACK_AND_WHITE', 'QUICK_TURN', 'JF', 'DECORATION', 'Braided rope in black and white', 0.15, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 330, true),
  ('HTV_PATCH_LESS_THAN_5CM', 'QUICK_TURN', 'JF', 'DECORATION', 'HTV Patch (less than 5cm)', 0.35, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 340, true),
  ('HTV_PATCH_5_10CM', 'QUICK_TURN', 'JF', 'DECORATION', 'HTV Patch (5-10cm)', 0.5, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 350, true),
  ('LESS_THAN_5CM_SILICONE_PATCH_NUMBER_OF_COLORS_1', 'QUICK_TURN', 'JF', 'DECORATION', 'Less than 5cm Silicone Patch Number of Colors 1', 0.8333333333333334, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 360, true),
  ('LESS_THAN_5CM_SILICONE_PATCH_NUMBER_OF_COLORS_2_3', 'QUICK_TURN', 'JF', 'DECORATION', 'Less than 5cm Silicone Patch Number of Colors 2-3', 0.9166666666666666, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 370, true),
  ('LESS_THAN_5CM_SILICONE_PATCH_NUMBER_OF_COLORS_4_7', 'QUICK_TURN', 'JF', 'DECORATION', 'Less than 5cm Silicone Patch Number of Colors 4-7', 1.0, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 380, true),
  ('5_7CM_SILICONE_PATCH_NUMBER_OF_COLORS_1', 'QUICK_TURN', 'JF', 'DECORATION', '5-7cm Silicone Patch Number of Colors 1', 1.0, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 390, true),
  ('5_7CM_SILICONE_PATCH_NUMBER_OF_COLORS_2_3', 'QUICK_TURN', 'JF', 'DECORATION', '5-7cm Silicone Patch Number of Colors 2-3', 1.0833333333333333, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 400, true),
  ('5_7CM_SILICONE_PATCH_NUMBER_OF_COLORS_4_7', 'QUICK_TURN', 'JF', 'DECORATION', '5-7cm Silicone Patch Number of Colors 4-7', 1.1666666666666667, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 410, true),
  ('7_10CM_SILICONE_PATCH_NUMBER_OF_COLORS_1', 'QUICK_TURN', 'JF', 'DECORATION', '7-10cm Silicone Patch Number of Colors 1', 1.1666666666666667, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 420, true),
  ('7_10CM_SILICONE_PATCH_NUMBER_OF_COLORS_2_3', 'QUICK_TURN', 'JF', 'DECORATION', '7-10cm Silicone Patch Number of Colors 2-3', 1.25, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 430, true),
  ('7_10CM_SILICONE_PATCH_NUMBER_OF_COLORS_4_7', 'QUICK_TURN', 'JF', 'DECORATION', '7-10cm Silicone Patch Number of Colors 4-7', 1.3333333333333333, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 440, true),
  ('VELCRO', 'QUICK_TURN', 'JF', 'CLOSURE', 'Velcro', 0.0, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 450, true),
  ('PLASTIC_TAB', 'QUICK_TURN', 'JF', 'CLOSURE', 'Plastic tab', 0.0, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 460, true),
  ('SLIDING_BUCKLE', 'QUICK_TURN', 'JF', 'CLOSURE', 'Sliding buckle', 0.058, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 470, true),
  ('BUCKLE_AND_GROMMET', 'QUICK_TURN', 'JF', 'CLOSURE', 'Buckle and grommet', 0.117, 'FLAT_PER_UNIT', NULL, '{}'::jsonb, 480, true)
) AS v(code, program_code, factory_code, category, name, unit_price, pricing_method, notes, input_config, sort_order, is_active)
JOIN public.quick_turn_programs p ON p.code = v.program_code
JOIN public.quick_turn_factories f ON f.code = v.factory_code
ON CONFLICT (code) DO UPDATE
SET program_id = EXCLUDED.program_id,
    factory_id = EXCLUDED.factory_id,
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    unit_price = EXCLUDED.unit_price,
    pricing_method = EXCLUDED.pricing_method,
    notes = EXCLUDED.notes,
    input_config = EXCLUDED.input_config,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.quick_turn_camo_options (
  code,
  factory_id,
  series,
  supplier,
  unit_price,
  sort_order,
  is_active
)
SELECT
  v.code,
  f.id,
  v.series,
  v.supplier,
  v.unit_price,
  v.sort_order,
  v.is_active
FROM (
VALUES
  ('I2005CAMO', 'JF', 'i2005camo', 'J&F', 0.41, 10, true),
  ('I2006', 'JF', 'i2006', 'J&F', 0.785, 20, true),
  ('I2011', 'JF', 'i2011', 'J&F', 0.625, 30, true),
  ('I2018', 'JF', 'i2018', 'J&F', 0.39999999999999997, 40, true),
  ('I2025', 'JF', 'i2025', 'J&F', 0.625, 50, true),
  ('I2027', 'JF', 'i2027', 'J&F', 0.68, 60, true),
  ('I2030CAMO', 'JF', 'i2030camo', 'J&F', 0.775, 70, true),
  ('I2030T', 'JF', 'i2030T', 'J&F', 0.7000000000000001, 80, true),
  ('I2031', 'JF', 'i2031', 'J&F', 0.775, 90, true),
  ('I2040', 'JF', 'i2040', 'J&F', 0.975, 100, true),
  ('I2065', 'JF', 'i2065', 'J&F', 0.395, 110, true),
  ('I2067', 'JF', 'i2067', 'J&F', 0.20916666666666664, 120, true),
  ('I2068_BLAZE', 'JF', 'i2068-blaze', 'J&F', 0.3441666666666667, 130, true),
  ('I2068', 'JF', 'i2068', 'J&F', 0.3441666666666667, 140, true),
  ('I2070', 'JF', 'i2070', 'J&F', 0.655, 150, true),
  ('I2075', 'JF', 'i2075', 'J&F', 0.325, 160, true),
  ('I2079', 'JF', 'i2079', 'J&F', 0.47500000000000003, 170, true),
  ('I2089', 'JF', 'i2089', 'J&F', 0.39999999999999997, 180, true),
  ('I3008', 'JF', 'i3008', 'J&F', 0.45, 190, true),
  ('I3008_BLAZE', 'JF', 'i3008 blaze', 'J&F', 0.45, 200, true),
  ('I3009', 'JF', 'i3009', 'J&F', 0.465, 210, true)
) AS v(code, factory_code, series, supplier, unit_price, sort_order, is_active)
JOIN public.quick_turn_factories f ON f.code = v.factory_code
ON CONFLICT (code) DO UPDATE
SET factory_id = EXCLUDED.factory_id,
    series = EXCLUDED.series,
    supplier = EXCLUDED.supplier,
    unit_price = EXCLUDED.unit_price,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

COMMIT;
