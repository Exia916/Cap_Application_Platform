-- db/migrations/029_recut_reason_accountability_reporting.sql
--
-- Adds configurable recut reason accountability support for reporting.
--
-- Business rules:
-- - Unconfigured recut reasons count against the operator by default.
-- - Configured active rules with is_accountable = false are excluded from accountable recut metrics.
-- - Matching/reporting logic will normalize names/reasons using trim/lower/space normalization.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS reporting;

CREATE OR REPLACE FUNCTION public.cap_report_normalize_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(regexp_replace(lower(btrim(coalesce(value, ''))), '\s+', ' ', 'g'), '');
$$;

CREATE TABLE IF NOT EXISTS public.recut_reason_accountability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reason_key text NOT NULL,
  reason_label text NOT NULL,

  is_accountable boolean NOT NULL DEFAULT true,
  notes text NULL,

  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,

  CONSTRAINT recut_reason_accountability_rules_reason_key_not_blank_chk
    CHECK (public.cap_report_normalize_key(reason_key) IS NOT NULL),

  CONSTRAINT recut_reason_accountability_rules_reason_label_not_blank_chk
    CHECK (public.cap_report_normalize_key(reason_label) IS NOT NULL),

  CONSTRAINT recut_reason_accountability_rules_reason_key_normalized_chk
    CHECK (reason_key = public.cap_report_normalize_key(reason_key))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recut_reason_accountability_rules_reason_key
  ON public.recut_reason_accountability_rules(reason_key);

CREATE INDEX IF NOT EXISTS idx_recut_reason_accountability_rules_active
  ON public.recut_reason_accountability_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_recut_reason_accountability_rules_accountable
  ON public.recut_reason_accountability_rules(is_accountable);

CREATE INDEX IF NOT EXISTS idx_recut_reason_accountability_rules_sort
  ON public.recut_reason_accountability_rules(sort_order, reason_label);

COMMENT ON TABLE public.recut_reason_accountability_rules IS
  'Configures whether recut reasons should count against operator recut-rate reporting. Unconfigured reasons count as accountable by default.';

COMMENT ON COLUMN public.recut_reason_accountability_rules.reason_key IS
  'Normalized recut reason key. Use public.cap_report_normalize_key(reason_label) when creating manual rules.';

COMMENT ON COLUMN public.recut_reason_accountability_rules.is_accountable IS
  'When false, matching recut reasons are included in gross recut metrics but excluded from accountable recut metrics.';

CREATE OR REPLACE VIEW reporting.v_recut_activity_accountability AS
SELECT
  r.record_id,
  r.recut_id,
  r.requested_at,
  r.requested_date,
  r.requested_time,

  r.requested_by_user_id,
  r.requested_by_username,
  r.requested_by_name,
  r.requested_by_employee_number,
  r.requested_department,

  r.sales_order_base,
  r.sales_order_display,
  r.sales_order,

  r.detail_number,
  r.design_name,
  r.recut_reason,
  public.cap_report_normalize_key(r.recut_reason) AS recut_reason_key,

  r.cap_style,
  r.pieces,
  r.operator,
  public.cap_report_normalize_key(r.operator) AS operator_match_key,

  r.deliver_to,

  r.supervisor_approved,
  r.supervisor_approved_at,
  r.supervisor_approved_by,

  r.warehouse_printed,
  r.warehouse_printed_at,
  r.warehouse_printed_by,

  r.do_not_pull,
  r.do_not_pull_at,
  r.do_not_pull_by,

  r.is_completed,
  r.completed_at,
  r.completed_by,

  r.recut_status,
  r.hours_to_complete,
  r.hours_open,

  r.notes,
  r.created_at,
  r.updated_at,

  r.is_voided,
  r.voided_at,
  r.voided_by,
  r.void_reason,

  r.record_url,

  rule.id AS accountability_rule_id,
  rule.reason_label AS accountability_reason_label,
  COALESCE(rule.is_accountable, true) AS is_accountable,
  CASE
    WHEN rule.id IS NOT NULL
      AND rule.is_active = true
      AND rule.is_accountable = false
    THEN true
    ELSE false
  END AS is_excluded_from_operator_rate
FROM reporting.v_recut_activity r
LEFT JOIN public.recut_reason_accountability_rules rule
  ON rule.reason_key = public.cap_report_normalize_key(r.recut_reason)
 AND rule.is_active = true;

CREATE OR REPLACE VIEW reporting.v_unclassified_recut_reasons AS
SELECT
  public.cap_report_normalize_key(r.recut_reason) AS recut_reason_key,
  min(NULLIF(btrim(r.recut_reason), '')) AS recut_reason,
  count(*)::integer AS recut_count,
  COALESCE(sum(COALESCE(r.pieces, 0)), 0)::integer AS recut_pieces,
  min(r.requested_date) AS first_requested_date,
  max(r.requested_date) AS last_requested_date
FROM reporting.v_recut_activity r
LEFT JOIN public.recut_reason_accountability_rules rule
  ON rule.reason_key = public.cap_report_normalize_key(r.recut_reason)
 AND rule.is_active = true
WHERE COALESCE(r.is_voided, false) = false
  AND public.cap_report_normalize_key(r.recut_reason) IS NOT NULL
  AND rule.id IS NULL
GROUP BY public.cap_report_normalize_key(r.recut_reason);

COMMENT ON VIEW reporting.v_recut_activity_accountability IS
  'Recut activity enriched with configurable accountability rules for operator recut-rate reporting.';

COMMENT ON VIEW reporting.v_unclassified_recut_reasons IS
  'Recut reasons seen in activity reporting that do not yet have an active accountability rule.';