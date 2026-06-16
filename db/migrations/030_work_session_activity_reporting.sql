-- db/migrations/030_work_session_activity_reporting.sql
--
-- Adds Work Session Activity reporting dataset support.
--
-- Notes:
-- - Open session duration uses NOW() at query time.
-- - Closed session duration uses time_out - time_in.
-- - Invalid or negative durations are defensively returned as 0.
-- - Related submission metrics currently follow Work Sessions All behavior:
--   knit_production_submissions joined by session_id,
--   knit_production_lines summed for total quantity.

CREATE SCHEMA IF NOT EXISTS reporting;

CREATE OR REPLACE VIEW reporting.v_work_session_activity AS
WITH session_metrics AS (
  SELECT
    ws.id,
    COUNT(DISTINCT ks.id)::integer AS submission_count,
    COALESCE(
      SUM(
        CASE
          WHEN ks.id IS NULL THEN 0
          ELSE COALESCE(kpl.quantity, 0)
        END
      ),
      0
    )::integer AS total_quantity
  FROM public.production_work_sessions ws
  LEFT JOIN public.knit_production_submissions ks
    ON ks.session_id = ws.id
   AND COALESCE(ks.is_voided, false) = false
  LEFT JOIN public.knit_production_lines kpl
    ON kpl.submission_id = ks.id
  GROUP BY ws.id
),
session_duration AS (
  SELECT
    ws.id,
    CASE
      WHEN COALESCE(ws.is_open, false) = true
        AND NOW() > ws.time_in
      THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - ws.time_in)) / 60)::integer

      WHEN ws.time_out IS NOT NULL
        AND ws.time_out > ws.time_in
      THEN FLOOR(EXTRACT(EPOCH FROM (ws.time_out - ws.time_in)) / 60)::integer

      ELSE 0
    END AS duration_minutes
  FROM public.production_work_sessions ws
)
SELECT
  ws.id,
  ws.id AS record_id,

  ws.work_date,
  ws.shift_date,
  ws.shift,

  ws.module_key,
  ws.area_code,
  COALESCE(cfg.area_label, ws.area_code) AS area_label,

  ws.operator_name,
  ws.employee_number,

  ws.time_in,
  ws.time_out,
  ws.is_open,

  COALESCE(sd.duration_minutes, 0)::integer AS duration_minutes,
  ROUND((COALESCE(sd.duration_minutes, 0)::numeric / 60.0), 2) AS duration_hours,

  COALESCE(sm.submission_count, 0)::integer AS submission_count,
  COALESCE(sm.total_quantity, 0)::integer AS total_quantity,

  ws.notes,
  COALESCE(ws.is_voided, false) AS is_voided,

  CONCAT('/platform/work-sessions/', ws.id::text) AS record_url
FROM public.production_work_sessions ws
LEFT JOIN public.production_work_area_config cfg
  ON cfg.module_key = ws.module_key
 AND cfg.area_code = ws.area_code
LEFT JOIN session_metrics sm
  ON sm.id = ws.id
LEFT JOIN session_duration sd
  ON sd.id = ws.id;

COMMENT ON VIEW reporting.v_work_session_activity IS
  'Reporting-ready work session activity view with query-time duration and related knit submission metrics.';