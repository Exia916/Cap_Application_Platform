BEGIN;

ALTER TABLE public.inbound_shipments
  ADD COLUMN IF NOT EXISTS estimated_cost_per_piece numeric(14,4),
  ADD COLUMN IF NOT EXISTS estimated_cost_per_dozen numeric(14,4);

COMMENT ON COLUMN public.inbound_shipments.estimated_cost_per_piece
  IS 'User-entered estimated cost per piece for the inbound shipment.';

COMMENT ON COLUMN public.inbound_shipments.estimated_cost_per_dozen
  IS 'User-entered estimated cost per dozen for the inbound shipment.';

CREATE OR REPLACE VIEW reporting.v_inbound_shipment_activity AS
WITH invoice_totals AS (
  SELECT
    inbound_shipment_id,
    COALESCE(SUM(COALESCE(amount, 0)), 0)::numeric(14,2) AS total_cost
  FROM public.inbound_shipment_invoices
  GROUP BY inbound_shipment_id
),
line_totals AS (
  SELECT
    inbound_shipment_id,
    COALESCE(SUM(COALESCE(quantity, 0)), 0)::bigint AS total_quantity
  FROM public.inbound_shipment_lines
  GROUP BY inbound_shipment_id
)
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
  ('/inbound-shipments/' || s.id::text) AS record_url,

  s.estimated_cost_per_piece::numeric(14,4) AS estimated_cost_per_piece,
  s.estimated_cost_per_dozen::numeric(14,4) AS estimated_cost_per_dozen,
  COALESCE(it.total_cost, 0)::numeric(14,2) AS total_cost,
  COALESCE(lt.total_quantity, 0)::bigint AS total_quantity,
  CASE
    WHEN COALESCE(lt.total_quantity, 0) > 0
      THEN ROUND((COALESCE(it.total_cost, 0) / lt.total_quantity)::numeric, 4)
    ELSE NULL
  END AS actual_cost_per_piece,
  CASE
    WHEN COALESCE(lt.total_quantity, 0) > 0
      THEN ROUND(((COALESCE(it.total_cost, 0) / lt.total_quantity) * 12)::numeric, 4)
    ELSE NULL
  END AS actual_cost_per_dozen
FROM public.inbound_shipments s
JOIN public.inbound_shipment_statuses st
  ON st.id = s.status_id
LEFT JOIN public.inbound_shipment_forwarders f
  ON f.id = s.forwarder_id
LEFT JOIN public.inbound_shipment_types t
  ON t.id = s.shipment_type_id
LEFT JOIN public.inbound_shipment_lines l
  ON l.inbound_shipment_id = s.id
LEFT JOIN invoice_totals it
  ON it.inbound_shipment_id = s.id
LEFT JOIN line_totals lt
  ON lt.inbound_shipment_id = s.id
WHERE s.is_voided = false;

COMMIT;