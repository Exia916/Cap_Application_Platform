BEGIN;

CREATE SCHEMA IF NOT EXISTS reporting;

-- ---------------------------------------------------------------------------
-- Inbound Shipment reporting dataset
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW reporting.v_inbound_shipment_activity AS
SELECT
  'Inbound Shipments'::text AS source_module,
  'inbound_shipments'::text AS source_table,
  s.id::text AS record_id,
  s.inbound_shipment_number,
  st.code AS status_code,
  st.label AS status_label,
  s.mbl_number,
  s.hbl_number,
  s.container_number,
  s.seal_number,
  s.port,
  s.carrier,
  COALESCE(f.label, NULLIF(TRIM(s.forwarder), '')) AS forwarder,
  f.code AS forwarder_code,
  COALESCE(t.label, NULLIF(TRIM(s.shipment_type), '')) AS shipment_type,
  t.code AS shipment_type_code,
  s.container_destination,
  s.etd,
  s.eta,
  CASE
    WHEN s.eta IS NULL THEN NULL
    ELSE (s.eta - CURRENT_DATE)::int
  END AS days_until_eta,
  CASE
    WHEN s.eta IS NULL THEN NULL
    WHEN s.eta >= CURRENT_DATE THEN 0
    WHEN st.code IN ('DELIVERED', 'RECEIVED_CLOSED') THEN 0
    ELSE (CURRENT_DATE - s.eta)::int
  END AS days_past_eta,
  s.carton_count,
  s.tariff_percentage,
  l.po_number,
  l.customer_id,
  l.customer_name,
  l.logo,
  l.tracking,
  l.line_destination,
  l.quantity,
  l.carton_count AS line_carton_count,
  l.notes AS line_notes,
  s.created_at,
  s.created_by,
  s.updated_at,
  s.updated_by,
  ('/inbound-shipments/' || s.id::text) AS record_url
FROM public.inbound_shipments s
JOIN public.inbound_shipment_statuses st
  ON st.id = s.status_id
LEFT JOIN public.inbound_shipment_forwarders f
  ON f.id = s.forwarder_id
LEFT JOIN public.inbound_shipment_types t
  ON t.id = s.shipment_type_id
LEFT JOIN public.inbound_shipment_lines l
  ON l.inbound_shipment_id = s.id
WHERE s.is_voided = false;

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_reporting_eta
  ON public.inbound_shipments (eta)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_reporting_status_eta
  ON public.inbound_shipments (status_id, eta)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_lines_reporting_customer_po
  ON public.inbound_shipment_lines (customer_name, po_number);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_lines_reporting_parent_sort
  ON public.inbound_shipment_lines (inbound_shipment_id, sort_order);

COMMIT;