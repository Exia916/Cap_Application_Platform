-- 037_external_partner_workflow_foundation.sql
-- External partner foundation for Workflow-first partner access.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- External partners
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  partner_type text NOT NULL CHECK (
    partner_type IN (
      'WORKFLOW_DESIGN',
      'WORKFLOW_DIGITIZING',
      'PRODUCTION'
    )
  ),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_external_partners_type_active
  ON public.external_partners (partner_type, is_active);

-- ---------------------------------------------------------------------------
-- Partner users
-- Uses regular CAP users. Do not create a separate external user table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_partner_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.external_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  external_role text NOT NULL CHECK (
    external_role IN (
      'EXTERNAL_DESIGNER',
      'EXTERNAL_DIGITIZER',
      'EXTERNAL_WORKFLOW_PARTNER',
      'EXTERNAL_VIEWER'
    )
  ),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT uq_external_partner_users_partner_user UNIQUE (partner_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_partner_users_one_active_partner
  ON public.external_partner_users (user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_external_partner_users_partner_active
  ON public.external_partner_users (partner_id, is_active);

CREATE INDEX IF NOT EXISTS idx_external_partner_users_user_active
  ON public.external_partner_users (user_id, is_active);

-- ---------------------------------------------------------------------------
-- Module access
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_partner_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.external_partners(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_assign_self boolean NOT NULL DEFAULT false,
  can_upload boolean NOT NULL DEFAULT false,
  can_download boolean NOT NULL DEFAULT false,
  can_note boolean NOT NULL DEFAULT false,
  can_complete boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT uq_external_partner_module_access UNIQUE (partner_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_external_partner_module_access_module_active
  ON public.external_partner_module_access (module_key, is_active);

-- ---------------------------------------------------------------------------
-- Required Workflow statuses
-- ---------------------------------------------------------------------------

INSERT INTO public.design_workflow_statuses (code, label, sort_order, is_active)
VALUES
  ('INSTOCK_CONCEPTS', 'Instock Concepts', 151, true),
  ('ART_DEPT_PROOFING', 'Art Dept. Proofing', 152, true),
  ('SIGN_IN_PROGRESS', 'Sign in Progress', 343, true),
  ('SIGN_FINISHED', 'Sign Finished', 344, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- External Workflow routing configuration
-- This is config-driven now, but the repo can still wrap it in typed helpers.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_workflow_status_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL DEFAULT 'design_workflow',
  partner_type text NOT NULL CHECK (
    partner_type IN (
      'WORKFLOW_DESIGN',
      'WORKFLOW_DIGITIZING'
    )
  ),
  status_code text NOT NULL REFERENCES public.design_workflow_statuses(code),
  assignment_field text NOT NULL CHECK (
    assignment_field IN ('designer', 'digitizer')
  ),
  visibility_mode text NOT NULL CHECK (
    visibility_mode IN ('blank_or_same_partner', 'same_partner_only')
  ),
  complete_to_status_code text NULL REFERENCES public.design_workflow_statuses(code),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT uq_external_workflow_status_access UNIQUE (
    module_key,
    partner_type,
    status_code,
    assignment_field
  )
);

CREATE INDEX IF NOT EXISTS idx_external_workflow_status_access_lookup
  ON public.external_workflow_status_access (
    module_key,
    partner_type,
    status_code,
    is_active
  );

INSERT INTO public.external_workflow_status_access (
  module_key,
  partner_type,
  status_code,
  assignment_field,
  visibility_mode,
  complete_to_status_code,
  is_active
)
VALUES
  (
    'design_workflow',
    'WORKFLOW_DESIGN',
    'INSTOCK_CONCEPTS',
    'designer',
    'blank_or_same_partner',
    'ART_DEPT_PROOFING',
    true
  ),
  (
    'design_workflow',
    'WORKFLOW_DESIGN',
    'A',
    'designer',
    'same_partner_only',
    'ART_DEPT_PROOFING',
    true
  ),
  (
    'design_workflow',
    'WORKFLOW_DESIGN',
    'RA',
    'designer',
    'same_partner_only',
    'ART_DEPT_PROOFING',
    true
  ),
  (
    'design_workflow',
    'WORKFLOW_DIGITIZING',
    'SIGN_IN_PROGRESS',
    'digitizer',
    'blank_or_same_partner',
    'SIGN_FINISHED',
    true
  )
ON CONFLICT (
  module_key,
  partner_type,
  status_code,
  assignment_field
) DO UPDATE
SET
  visibility_mode = EXCLUDED.visibility_mode,
  complete_to_status_code = EXCLUDED.complete_to_status_code,
  is_active = true,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Partner notes
-- Separate from internal comments for Phase 1.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.design_workflow_external_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.design_workflow_requests(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.external_partners(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_by_user_id uuid NULL REFERENCES public.users(id),
  created_by_name text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_workflow_external_notes_request
  ON public.design_workflow_external_notes (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_design_workflow_external_notes_partner
  ON public.design_workflow_external_notes (partner_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed initial partners
-- ---------------------------------------------------------------------------

INSERT INTO public.external_partners (code, name, partner_type, is_active)
VALUES
  ('DCX', 'DCX', 'WORKFLOW_DESIGN', true),
  ('OFFICE_BEACON', 'Office Beacon', 'WORKFLOW_DESIGN', true),
  ('SIGN_DIGITIZING', 'Sign Digitizing', 'WORKFLOW_DIGITIZING', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  partner_type = EXCLUDED.partner_type,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.external_partner_module_access (
  partner_id,
  module_key,
  can_view,
  can_assign_self,
  can_upload,
  can_download,
  can_note,
  can_complete,
  is_active
)
SELECT
  ep.id,
  'design_workflow',
  true,
  true,
  true,
  true,
  true,
  true,
  true
FROM public.external_partners ep
WHERE ep.code IN ('DCX', 'OFFICE_BEACON', 'SIGN_DIGITIZING')
ON CONFLICT (partner_id, module_key) DO UPDATE
SET
  can_view = true,
  can_assign_self = true,
  can_upload = true,
  can_download = true,
  can_note = true,
  can_complete = true,
  is_active = true,
  updated_at = NOW();

COMMIT;