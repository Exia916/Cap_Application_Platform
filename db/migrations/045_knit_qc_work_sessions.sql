-- 045_knit_qc_work_sessions.sql
-- Add Work Session support to Knit QC and align new Knit Production sewing areas.

ALTER TABLE public.knit_qc_submissions
  ADD COLUMN IF NOT EXISTS session_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_knit_qc_submissions_session_id'
  ) THEN
    ALTER TABLE public.knit_qc_submissions
      ADD CONSTRAINT fk_knit_qc_submissions_session_id
      FOREIGN KEY (session_id)
      REFERENCES public.production_work_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knit_qc_submissions_session_id
  ON public.knit_qc_submissions(session_id);

-- Make sure the new Knit Area lookup values exist for Knit Production.
INSERT INTO public.knit_area_lookup (
  area_name,
  sort_order,
  is_active
)
VALUES
  ('EK/RK sewing', 36, true),
  ('TK/SK sewing', 37, true)
ON CONFLICT (area_name) DO UPDATE
SET
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Make sure the matching Knit Production work-session areas exist.
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
  ('knit_production', 'EK/RK SEWING', 'EK/RK sewing', 36, true, 'migration', 'migration'),
  ('knit_production', 'TK/SK SEWING', 'TK/SK sewing', 37, true, 'migration', 'migration')
ON CONFLICT (module_key, area_code) DO UPDATE
SET
  area_label = EXCLUDED.area_label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW(),
  updated_by = 'migration';

-- Add Knit QC work-session areas using a separate module key.
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
  ('knit_qc', 'EK/RK SEWING', 'EK/RK sewing', 36, true, 'migration', 'migration'),
  ('knit_qc', 'TK/SK SEWING', 'TK/SK sewing', 37, true, 'migration', 'migration')
ON CONFLICT (module_key, area_code) DO UPDATE
SET
  area_label = EXCLUDED.area_label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW(),
  updated_by = 'migration';
