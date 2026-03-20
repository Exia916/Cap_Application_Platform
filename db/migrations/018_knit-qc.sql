-- Migration for the Knit QC module.
--
-- This script creates the tables and indexes required for the
-- knit_qc module including submissions, submission lines and
-- reject reasons. It follows the same naming conventions,
-- primary keys and timestamp patterns used across the Cap
-- Applications Platform. Void support columns are included on
-- submissions. All dates are stored in UTC with separate
-- entry_date and shift_date fields derived in application code.

CREATE TABLE IF NOT EXISTS public.knit_qc_reject_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Seed the reject reasons table with standard values. These provide
-- the dropdown options presented in the Knit QC form. The sort_order
-- column controls the ordering in the UI. Only active entries are
-- returned by the API layer.
INSERT INTO public.knit_qc_reject_reasons (label, sort_order, is_active)
VALUES
  ('Poor Quality', 1, TRUE),
  ('Sewn too short', 2, TRUE),
  ('Sewn too long', 3, TRUE),
  ('Crooked Dart', 4, TRUE),
  ('Uneven Crown', 5, TRUE),
  ('Cuff Measurement issue', 6, TRUE),
  ('Turned Crooked', 7, TRUE),
  ('Crooked Pom', 8, TRUE),
  ('Excessive Glue', 9, TRUE),
  ('Other', 10, TRUE)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.knit_qc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ts timestamptz NOT NULL,
  entry_date date NOT NULL,
  name text NOT NULL,
  employee_number integer NOT NULL,
  shift text NULL,
  stock_order boolean NOT NULL DEFAULT false,
  sales_order_base text NULL,
  sales_order_display text NULL,
  notes text NULL,
  is_voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz NULL,
  voided_by text NULL,
  void_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.knit_qc_submission_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL
    REFERENCES public.knit_qc_submissions(id)
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
  detail_number integer NOT NULL,
  logo text NOT NULL,
  order_quantity integer NOT NULL CHECK (order_quantity >= 0),
  inspected_quantity integer NOT NULL CHECK (inspected_quantity >= 0),
  rejected_quantity integer NOT NULL CHECK (rejected_quantity >= 0),
  reject_reason_id uuid NOT NULL
    REFERENCES public.knit_qc_reject_reasons(id),
  qc_employee_number integer NOT NULL,
  line_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submissions_entry_date
  ON public.knit_qc_submissions(entry_date);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submissions_employee_number
  ON public.knit_qc_submissions(employee_number);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submissions_sales_order_base
  ON public.knit_qc_submissions(sales_order_base);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submissions_sales_order_display
  ON public.knit_qc_submissions(sales_order_display);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submissions_shift
  ON public.knit_qc_submissions(shift);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submissions_is_voided
  ON public.knit_qc_submissions(is_voided);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_submission_id
  ON public.knit_qc_submission_lines(submission_id);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_entry_date
  ON public.knit_qc_submission_lines(entry_date);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_shift_date
  ON public.knit_qc_submission_lines(shift_date);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_sales_order_base
  ON public.knit_qc_submission_lines(sales_order_base);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_sales_order_display
  ON public.knit_qc_submission_lines(sales_order_display);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_detail_number
  ON public.knit_qc_submission_lines(detail_number);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_logo
  ON public.knit_qc_submission_lines(logo);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_reject_reason_id
  ON public.knit_qc_submission_lines(reject_reason_id);

CREATE INDEX IF NOT EXISTS idx_knit_qc_submission_lines_qc_employee_number
  ON public.knit_qc_submission_lines(qc_employee_number);