CREATE TABLE IF NOT EXISTS public.knit_area_lookup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.knit_area_lookup (area_name, sort_order)
VALUES
  ('Operator', 10),
  ('Steaming', 20),
  ('Turning', 30),
  ('Sewers', 40),
  ('Poms', 50)
ON CONFLICT (area_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.knit_production_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ts timestamptz NOT NULL,
  entry_date date NOT NULL,
  name text NOT NULL,
  employee_number integer NOT NULL,
  shift text NULL,
  stock_order boolean NOT NULL DEFAULT false,
  sales_order_base text NULL,
  sales_order_display text NULL,
  knit_area text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.knit_production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL
    REFERENCES public.knit_production_submissions(id)
    ON DELETE CASCADE,
  entry_ts timestamptz NOT NULL,
  entry_date date NOT NULL,
  shift_date date NULL,
  name text NOT NULL,
  employee_number integer NOT NULL,
  shift text NULL,
  stock_order boolean NOT NULL DEFAULT false,
  sales_order_base text NULL,
  sales_order_display text NULL,
  knit_area text NULL,
  detail_number integer NOT NULL,
  item_style text NOT NULL,
  logo text NOT NULL,
  quantity integer NOT NULL CHECK (quantity >= 0),
  line_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.knit_production_submissions
  ADD COLUMN IF NOT EXISTS knit_area text NULL;

ALTER TABLE public.knit_production_lines
  ADD COLUMN IF NOT EXISTS knit_area text NULL;

UPDATE public.knit_production_submissions
SET knit_area = COALESCE(knit_area, 'Operator')
WHERE knit_area IS NULL;

UPDATE public.knit_production_lines
SET knit_area = COALESCE(knit_area, 'Operator')
WHERE knit_area IS NULL;

ALTER TABLE public.knit_production_submissions
  ALTER COLUMN knit_area SET NOT NULL;

ALTER TABLE public.knit_production_lines
  ALTER COLUMN knit_area SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_knit_production_submissions_knit_area_lookup'
  ) THEN
    ALTER TABLE public.knit_production_submissions
      ADD CONSTRAINT fk_knit_production_submissions_knit_area_lookup
      FOREIGN KEY (knit_area)
      REFERENCES public.knit_area_lookup(area_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_knit_production_lines_knit_area_lookup'
  ) THEN
    ALTER TABLE public.knit_production_lines
      ADD CONSTRAINT fk_knit_production_lines_knit_area_lookup
      FOREIGN KEY (knit_area)
      REFERENCES public.knit_area_lookup(area_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knit_area_lookup_area_name
  ON public.knit_area_lookup(area_name);

CREATE INDEX IF NOT EXISTS idx_knit_area_lookup_is_active
  ON public.knit_area_lookup(is_active);

CREATE INDEX IF NOT EXISTS idx_knit_prod_submissions_entry_date
  ON public.knit_production_submissions(entry_date);

CREATE INDEX IF NOT EXISTS idx_knit_prod_submissions_employee_number
  ON public.knit_production_submissions(employee_number);

CREATE INDEX IF NOT EXISTS idx_knit_prod_submissions_sales_order_base
  ON public.knit_production_submissions(sales_order_base);

CREATE INDEX IF NOT EXISTS idx_knit_prod_submissions_sales_order_display
  ON public.knit_production_submissions(sales_order_display);

CREATE INDEX IF NOT EXISTS idx_knit_prod_submissions_shift
  ON public.knit_production_submissions(shift);

CREATE INDEX IF NOT EXISTS idx_knit_prod_submissions_knit_area
  ON public.knit_production_submissions(knit_area);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_submission_id
  ON public.knit_production_lines(submission_id);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_entry_date
  ON public.knit_production_lines(entry_date);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_shift_date
  ON public.knit_production_lines(shift_date);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_sales_order_base
  ON public.knit_production_lines(sales_order_base);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_sales_order_display
  ON public.knit_production_lines(sales_order_display);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_item_style
  ON public.knit_production_lines(item_style);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_logo
  ON public.knit_production_lines(logo);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_shift
  ON public.knit_production_lines(shift);

CREATE INDEX IF NOT EXISTS idx_knit_prod_lines_knit_area
  ON public.knit_production_lines(knit_area);