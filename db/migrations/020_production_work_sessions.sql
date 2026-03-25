CREATE TABLE IF NOT EXISTS public.production_work_area_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  area_code text NOT NULL,
  area_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text NULL,
  updated_by text NULL,
  CONSTRAINT uq_production_work_area_config_module_area UNIQUE (module_key, area_code)
);

CREATE TABLE IF NOT EXISTS public.production_work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  area_code text NOT NULL,
  work_date date NOT NULL,
  shift_date date NULL,
  shift text NULL,
  user_id text NULL,
  username text NULL,
  employee_number integer NULL,
  operator_name text NOT NULL,
  time_in timestamptz NOT NULL,
  time_out timestamptz NULL,
  is_open boolean NOT NULL DEFAULT true,
  notes text NULL,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text NULL,
  updated_by text NULL,

  is_voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz NULL,
  voided_by text NULL,
  void_reason text NULL,

  CONSTRAINT fk_production_work_sessions_area
    FOREIGN KEY (module_key, area_code)
    REFERENCES public.production_work_area_config(module_key, area_code),

  CONSTRAINT chk_production_work_sessions_time_order
    CHECK (time_out IS NULL OR time_out > time_in)
);

ALTER TABLE public.knit_production_submissions
  ADD COLUMN IF NOT EXISTS session_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_knit_production_submissions_session_id'
  ) THEN
    ALTER TABLE public.knit_production_submissions
      ADD CONSTRAINT fk_knit_production_submissions_session_id
      FOREIGN KEY (session_id)
      REFERENCES public.production_work_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_production_work_area_config_module_active
  ON public.production_work_area_config(module_key, is_active, sort_order, area_label);

CREATE INDEX IF NOT EXISTS idx_production_work_area_config_module_area
  ON public.production_work_area_config(module_key, area_code);

CREATE INDEX IF NOT EXISTS idx_production_work_sessions_module_employee_open
  ON public.production_work_sessions(module_key, employee_number, is_open)
  WHERE COALESCE(is_voided, false) = false;

CREATE INDEX IF NOT EXISTS idx_production_work_sessions_user_module_open
  ON public.production_work_sessions(user_id, module_key, is_open)
  WHERE COALESCE(is_voided, false) = false;

CREATE INDEX IF NOT EXISTS idx_production_work_sessions_work_date
  ON public.production_work_sessions(work_date);

CREATE INDEX IF NOT EXISTS idx_production_work_sessions_shift_date
  ON public.production_work_sessions(shift_date);

CREATE INDEX IF NOT EXISTS idx_production_work_sessions_time_in
  ON public.production_work_sessions(time_in);

CREATE INDEX IF NOT EXISTS idx_knit_production_submissions_session_id
  ON public.knit_production_submissions(session_id);

INSERT INTO public.production_work_area_config (
  module_key,
  area_code,
  area_label,
  sort_order,
  is_active,
  created_by,
  updated_by
)
VALUES
  ('knit_production', 'EK OPERATOR', 'EK Operator', 10, true, 'migration', 'migration'),
  ('knit_production', 'TK OPERATOR', 'TK Operator', 15, true, 'migration', 'migration'),
  ('knit_production', 'EK STEAMING', 'EK Steaming', 20, true, 'migration', 'migration'),
  ('knit_production', 'TK STEAMING', 'TK Steaming', 25, true, 'migration', 'migration'),
  ('knit_production', 'EK TURNING', 'EK Turning', 30, true, 'migration', 'migration'),
  ('knit_production', 'TK TURNING', 'TK Turning', 35, true, 'migration', 'migration'),
  ('knit_production', 'SEWERS', 'Sewers', 40, true, 'migration', 'migration'),
  ('knit_production', 'POMS', 'Poms', 50, true, 'migration', 'migration')
ON CONFLICT (module_key, area_code) DO UPDATE
SET
  area_label = EXCLUDED.area_label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW(),
  updated_by = 'migration';