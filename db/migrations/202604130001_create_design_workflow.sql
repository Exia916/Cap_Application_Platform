-- Design Workflow backend foundation
-- Drop-in replacement / corrective migration for initial scaffold

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Statuses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_statuses (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.design_workflow_statuses
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Seed statuses
INSERT INTO public.design_workflow_statuses (code, label, sort_order) VALUES
  ('UNSPECIFIED', 'Unspecified', 0),
  ('A', 'A PO To Art Dept.', 10),
  ('B', 'B Customer Approval of Art', 20),
  ('C', 'C Complete SO & Digitize', 30),
  ('D', 'D Tape Complete', 40),
  ('E', 'E Order To Factory', 50),
  ('F', 'F Run Sample', 60),
  ('G', 'G Sample To Sewing Line', 70),
  ('H', 'H Sample Ran', 80),
  ('I', 'I ET Staging', 90),
  ('L', 'L Assigned - In Production', 100),
  ('MMC', 'MMC Pending Art', 110),
  ('N', 'N Proofing', 120),
  ('O', 'O Edit', 130),
  ('Q', 'Q Stop Ship', 140),
  ('R', 'R PO to Concept Art', 150),
  ('S', 'S Concept Complete', 160),
  ('T', 'T Customer Approval of Concept', 170),
  ('U', 'U Quote', 180),
  ('W', 'W Quote Complete', 190),
  ('X', 'X Customer Approval of Sketch', 200),
  ('Y', 'Y Run Sample Overseas', 210),
  ('Z', 'Z Customer Approval of Overseas Sample', 220),
  ('ZA', 'Za Order to Overseas Factory', 230),
  ('RA', 'Ra Revisions', 240),
  ('ZB', 'Zb Overseas Sample in Progress', 250),
  ('ZC', 'Zc Overseas Order in Production', 260),
  ('ZD', 'Zd Overseas Customer Approval of Art', 270),
  ('ZE', 'Ze PO to Overseas Art', 280),
  ('ZF', 'Zf Overseas Sample Pending Answers', 290),
  ('CA', 'Ca Overseas Tape', 300),
  ('DA', 'Da Screen Complete', 310),
  ('AA', 'Aa EK Approved', 320),
  ('TA', 'Ta Customer Approval of Quote', 330),
  ('LRD', 'L Ready For Digitizing', 340),
  ('CB', 'Cb Embroidery for Knit', 350),
  ('ART_FIX', 'z Art Fix', 360),
  ('DB', 'Db Leather Complete', 370),
  ('BA', 'Ba Pending Patch Approval From Factory', 380)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL,

  sales_order_number text NULL,
  sales_order_base text NULL,
  sales_order_display text NULL,

  po_number text NULL,
  tape_name text NULL,

  date_request_created timestamptz NOT NULL DEFAULT NOW(),
  due_date date NULL,

  customer_name text NULL,
  customer_code text NULL,
  bin_code text NULL,

  created_by_user_id text NULL,
  created_by_name text NULL,

  digitizer_user_id text NULL,
  digitizer_name text NULL,

  designer_user_id text NULL,
  designer_name text NULL,

  status_id integer NOT NULL REFERENCES public.design_workflow_statuses(id),

  instructions text NULL,
  additional_instructions text NULL,
  colorways_text text NULL,

  tape_number text NULL,
  rush boolean NOT NULL DEFAULT false,
  style_code text NULL,
  sample_so_number text NULL,
  stitch_count integer NULL,
  art_proof boolean NOT NULL DEFAULT false,

  is_voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz NULL,
  voided_by text NULL,
  void_reason text NULL,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by text NULL
);

ALTER TABLE public.design_workflow_requests
  ADD COLUMN IF NOT EXISTS sales_order_display text NULL;

ALTER TABLE public.design_workflow_requests
  ALTER COLUMN date_request_created TYPE timestamptz
  USING CASE
    WHEN date_request_created IS NULL THEN NOW()
    ELSE date_request_created::timestamptz
  END;

ALTER TABLE public.design_workflow_requests
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at::timestamptz;

ALTER TABLE public.design_workflow_requests
  ALTER COLUMN updated_at TYPE timestamptz
  USING updated_at::timestamptz;

ALTER TABLE public.design_workflow_requests
  ALTER COLUMN voided_at TYPE timestamptz
  USING voided_at::timestamptz;

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_status
  ON public.design_workflow_requests (status_id);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_due_date
  ON public.design_workflow_requests (due_date);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_digitizer
  ON public.design_workflow_requests (digitizer_user_id);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_designer
  ON public.design_workflow_requests (designer_user_id);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_sales_order
  ON public.design_workflow_requests (sales_order_number);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_sales_order_base
  ON public.design_workflow_requests (sales_order_base);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_sales_order_display
  ON public.design_workflow_requests (sales_order_display);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_status_void
  ON public.design_workflow_requests (status_id, is_voided);

CREATE INDEX IF NOT EXISTS idx_design_workflow_requests_created_at
  ON public.design_workflow_requests (created_at DESC);

-- ---------------------------------------------------------------------------
-- Status history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_status_history (
  id bigserial PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.design_workflow_requests(id) ON DELETE CASCADE,
  status_id integer NOT NULL REFERENCES public.design_workflow_statuses(id),
  changed_at timestamptz NOT NULL DEFAULT NOW(),
  changed_by_user_id text NULL,
  changed_by_name text NULL
);

ALTER TABLE public.design_workflow_status_history
  ALTER COLUMN changed_at TYPE timestamptz
  USING changed_at::timestamptz;

CREATE INDEX IF NOT EXISTS idx_design_workflow_status_history_request
  ON public.design_workflow_status_history (request_id);

CREATE INDEX IF NOT EXISTS idx_design_workflow_status_history_request_changed
  ON public.design_workflow_status_history (request_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- User preferences
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_user_preferences (
  user_id text PRIMARY KEY,
  last_search jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Saved searches
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_saved_searches (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  search_criteria jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_design_workflow_saved_searches_user_name'
  ) THEN
    ALTER TABLE public.design_workflow_saved_searches
      ADD CONSTRAINT uq_design_workflow_saved_searches_user_name
      UNIQUE (user_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_design_workflow_saved_searches_user
  ON public.design_workflow_saved_searches (user_id);

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- Bins
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_bins (
  id bigserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.design_workflow_bins (code, sort_order)
VALUES
  ('1 PROACTIVE CONCEPTS', 10),
  ('1 SPECIAL REQUEST', 20),
  ('1SPG', 30),
  ('Charlotte M', 40),
  ('Danni H', 50),
  ('Kellee A', 60),
  ('Kelly W', 70),
  ('Labels', 80),
  ('Patience J', 90),
  ('Poms', 100),
  ('Sandy B', 110),
  ('Sarah P', 120),
  ('Sasha G', 130),
  ('Tammy D', 140),
  ('Tina K', 150),
  ('Unspecified', 160)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_design_workflow_bins_active
  ON public.design_workflow_bins (is_active, sort_order, code);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_customers (
  id bigserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_workflow_customers_active
  ON public.design_workflow_customers (is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_design_workflow_customers_code
  ON public.design_workflow_customers (code);

-- ---------------------------------------------------------------------------
-- Styles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_styles (
  id bigserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_workflow_styles_active
  ON public.design_workflow_styles (is_active, sort_order, code);

COMMIT;