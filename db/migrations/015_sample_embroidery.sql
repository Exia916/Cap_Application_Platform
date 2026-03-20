CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_name_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_name_key UNIQUE (name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_employee_number_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_employee_number_key UNIQUE (employee_number);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sample_embroidery_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ts timestamptz NOT NULL DEFAULT now(),
  entry_date date GENERATED ALWAYS AS ((entry_ts AT TIME ZONE 'America/Chicago')::date) STORED,
  name text NOT NULL,
  employee_number integer NOT NULL,
  sales_order bigint,
  detail_count integer NOT NULL CHECK (detail_count >= 0),
  quantity integer NOT NULL CHECK (quantity >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sample_embroidery_entries_sales_order_7_digits_chk
    CHECK (sales_order IS NULL OR sales_order BETWEEN 1000000 AND 9999999),

  CONSTRAINT sample_embroidery_entries_name_fk
    FOREIGN KEY (name)
    REFERENCES public.users (name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT sample_embroidery_entries_employee_number_fk
    FOREIGN KEY (employee_number)
    REFERENCES public.users (employee_number)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sample_embroidery_entries_entry_date
  ON public.sample_embroidery_entries (entry_date);

CREATE INDEX IF NOT EXISTS idx_sample_embroidery_entries_name_entry_date
  ON public.sample_embroidery_entries (name, entry_date);

CREATE INDEX IF NOT EXISTS idx_sample_embroidery_entries_sales_order
  ON public.sample_embroidery_entries (sales_order);

CREATE INDEX IF NOT EXISTS idx_sample_embroidery_entries_detail_count
  ON public.sample_embroidery_entries (detail_count);

CREATE INDEX IF NOT EXISTS idx_sample_embroidery_entries_quantity
  ON public.sample_embroidery_entries (quantity);

CREATE OR REPLACE FUNCTION public.set_sample_embroidery_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sample_embroidery_updated_at
ON public.sample_embroidery_entries;

CREATE TRIGGER trg_sample_embroidery_updated_at
BEFORE UPDATE ON public.sample_embroidery_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_sample_embroidery_updated_at();