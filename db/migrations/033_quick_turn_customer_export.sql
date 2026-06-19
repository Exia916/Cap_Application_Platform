-- db/migrations/033_quick_turn_customer_export.sql
-- Customer-facing Quick Turn quote setup, selected method/breaks, and item photo references.

BEGIN;

CREATE TABLE IF NOT EXISTS public.quick_turn_quote_customer_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL UNIQUE REFERENCES public.quick_turn_quotes(id) ON DELETE CASCADE,

  selected_calculator_id integer NULL REFERENCES public.quick_turn_calculators(id) ON DELETE SET NULL,
  selected_calculator_code text NULL,
  selected_calculator_name_snapshot text NULL,

  prepared_for_customer_id bigint NULL REFERENCES public.design_workflow_customers(id) ON DELETE SET NULL,
  prepared_for_customer_code_snapshot text NULL,
  prepared_for_customer_name_snapshot text NULL,
  quote_prepared_for_display text NULL,

  workflow_sales_order_number text NULL,
  program_logo_text text NULL,
  cap_program_name text NOT NULL DEFAULT 'Quick Turn',
  customer_service_contact text NULL,
  sample_production_details text NULL,
  production_time_details text NULL,
  fob text NOT NULL DEFAULT '1 U.S. Final Destination',
  additional_information text NULL,

  export_snapshot jsonb NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  created_by_user_id uuid NULL,
  created_by_employee_number integer NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  updated_by_user_id uuid NULL,
  updated_by_employee_number integer NULL
);

CREATE TABLE IF NOT EXISTS public.quick_turn_quote_customer_export_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id uuid NOT NULL REFERENCES public.quick_turn_quote_customer_exports(id) ON DELETE CASCADE,
  quote_item_id uuid NOT NULL REFERENCES public.quick_turn_quote_items(id) ON DELETE CASCADE,

  option_label text NULL,
  customer_description text NULL,
  customer_notes text NULL,
  factory_display text NULL,
  selected_breaks jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Reserved for future programs. Quick Turn uses the quote-level selected method.
  selected_method_code text NULL,

  image_attachment_id bigint NULL REFERENCES public.attachments(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quick_turn_quote_customer_export_items_uniq UNIQUE (export_id, quote_item_id),
  CONSTRAINT quick_turn_quote_customer_export_items_breaks_array_chk CHECK (jsonb_typeof(selected_breaks) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_qt_customer_exports_quote
  ON public.quick_turn_quote_customer_exports(quote_id);

CREATE INDEX IF NOT EXISTS idx_qt_customer_exports_customer
  ON public.quick_turn_quote_customer_exports(prepared_for_customer_id);

CREATE INDEX IF NOT EXISTS idx_qt_customer_exports_selected_calculator
  ON public.quick_turn_quote_customer_exports(selected_calculator_code);

CREATE INDEX IF NOT EXISTS idx_qt_customer_export_items_export
  ON public.quick_turn_quote_customer_export_items(export_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_qt_customer_export_items_quote_item
  ON public.quick_turn_quote_customer_export_items(quote_item_id);

CREATE INDEX IF NOT EXISTS idx_qt_customer_export_items_image_attachment
  ON public.quick_turn_quote_customer_export_items(image_attachment_id);

COMMIT;
