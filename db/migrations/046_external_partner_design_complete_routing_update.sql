-- 046_external_partner_design_complete_routing_update.sql
-- Update external partner Design completion routing only.
-- Digitizing completion remains Sign in Progress -> Sign Finished.

BEGIN;

-- Keep the existing concept-proofing code, but update the user-facing label.
INSERT INTO public.design_workflow_statuses (
  code,
  label,
  sort_order,
  is_active
)
VALUES
  ('ART_DEPT_PROOFING', 'Art Dept. Concept Proofing', 152, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = NOW();

-- Add the separate approval-proofing target used only when external Design
-- completes a record currently in status A / A PO To Art Dept.
-- This uses the exact status code requested.
INSERT INTO public.design_workflow_statuses (
  code,
  label,
  sort_order,
  is_active
)
VALUES
  ('Art_Dept._approval_proofing', 'Art Dept. approval proofing', 153, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = NOW();

-- Preserve Design routing for Instock Concepts and RA Revisions:
-- Complete -> ART_DEPT_PROOFING / Art Dept. Concept Proofing.
UPDATE public.external_workflow_status_access
SET
  complete_to_status_code = 'ART_DEPT_PROOFING',
  is_active = true,
  updated_at = NOW()
WHERE module_key = 'design_workflow'
  AND partner_type = 'WORKFLOW_DESIGN'
  AND assignment_field = 'designer'
  AND status_code IN ('INSTOCK_CONCEPTS', 'RA');

-- Change Design routing for A / A PO To Art Dept. only:
-- Complete -> Art_Dept._approval_proofing / Art Dept. approval proofing.
UPDATE public.external_workflow_status_access
SET
  complete_to_status_code = 'Art_Dept._approval_proofing',
  is_active = true,
  updated_at = NOW()
WHERE module_key = 'design_workflow'
  AND partner_type = 'WORKFLOW_DESIGN'
  AND assignment_field = 'designer'
  AND status_code = 'A';

-- Defensive upserts in case a routing row was missed in the earlier foundation migration.
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
    'RA',
    'designer',
    'same_partner_only',
    'ART_DEPT_PROOFING',
    true
  ),
  (
    'design_workflow',
    'WORKFLOW_DESIGN',
    'A',
    'designer',
    'same_partner_only',
    'Art_Dept._approval_proofing',
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

-- Leave digitizing unchanged. This is included only as a guardrail if that row was missing.
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

COMMIT;
