BEGIN;

-- ---------------------------------------------------------------------------
-- Inbound Shipment Statuses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inbound_shipment_statuses (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.inbound_shipment_statuses (
  id,
  code,
  label,
  sort_order,
  is_active
)
VALUES
  (1, 'DRAFT', 'Draft', 10, true),
  (2, 'AWAITING_DEPARTURE', 'Awaiting Departure', 20, true),
  (3, 'IN_TRANSIT', 'In Transit', 30, true),
  (4, 'ARRIVED_AT_PORT', 'Arrived at Port', 40, true),
  (5, 'CUSTOMS_HOLD', 'Customs Hold', 50, true),
  (6, 'CUSTOMS_CLEARED', 'Customs Cleared', 60, true),
  (7, 'DELIVERED', 'Delivered', 70, true),
  (8, 'RECEIVED_CLOSED', 'Received / Closed', 80, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

SELECT setval(
  pg_get_serial_sequence('public.inbound_shipment_statuses', 'id'),
  COALESCE((SELECT MAX(id) FROM public.inbound_shipment_statuses), 1),
  true
);

-- ---------------------------------------------------------------------------
-- Inbound Shipment Invoice Types
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inbound_shipment_invoice_types (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.inbound_shipment_invoice_types (
  id,
  code,
  label,
  sort_order,
  is_active
)
VALUES
  (1, 'COMMERCIAL_INVOICE', 'Commercial Invoice', 10, true),
  (2, 'FREIGHT_INVOICE', 'Freight Invoice', 20, true),
  (3, 'DUTY_INVOICE', 'Duty Invoice', 30, true),
  (4, 'TARIFF_INVOICE', 'Tariff Invoice', 40, true),
  (5, 'OTHER', 'Other', 50, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

SELECT setval(
  pg_get_serial_sequence('public.inbound_shipment_invoice_types', 'id'),
  COALESCE((SELECT MAX(id) FROM public.inbound_shipment_invoice_types), 1),
  true
);

-- ---------------------------------------------------------------------------
-- Convert inbound_shipments.status text to status_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.inbound_shipments
  DROP CONSTRAINT IF EXISTS inbound_shipments_status_chk;

ALTER TABLE public.inbound_shipments
  ADD COLUMN IF NOT EXISTS status_id integer;

UPDATE public.inbound_shipments s
SET status_id = st.id
FROM public.inbound_shipment_statuses st
WHERE s.status_id IS NULL
  AND (
    st.label = s.status
    OR st.code = s.status
  );

UPDATE public.inbound_shipments
SET status_id = 1
WHERE status_id IS NULL;

ALTER TABLE public.inbound_shipments
  ALTER COLUMN status_id SET NOT NULL;

ALTER TABLE public.inbound_shipments
  ALTER COLUMN status_id SET DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inbound_shipments_status'
  ) THEN
    ALTER TABLE public.inbound_shipments
      ADD CONSTRAINT fk_inbound_shipments_status
      FOREIGN KEY (status_id)
      REFERENCES public.inbound_shipment_statuses(id);
  END IF;
END $$;

ALTER TABLE public.inbound_shipments
  DROP COLUMN IF EXISTS status;

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_status_id
  ON public.inbound_shipments(status_id);

-- ---------------------------------------------------------------------------
-- Convert invoice_type text to invoice_type_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.inbound_shipment_invoices
  DROP CONSTRAINT IF EXISTS inbound_shipment_invoices_type_chk;

ALTER TABLE public.inbound_shipment_invoices
  ADD COLUMN IF NOT EXISTS invoice_type_id integer NULL;

UPDATE public.inbound_shipment_invoices i
SET invoice_type_id = t.id
FROM public.inbound_shipment_invoice_types t
WHERE i.invoice_type_id IS NULL
  AND (
    t.label = i.invoice_type
    OR t.code = i.invoice_type
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inbound_shipment_invoices_type'
  ) THEN
    ALTER TABLE public.inbound_shipment_invoices
      ADD CONSTRAINT fk_inbound_shipment_invoices_type
      FOREIGN KEY (invoice_type_id)
      REFERENCES public.inbound_shipment_invoice_types(id);
  END IF;
END $$;

ALTER TABLE public.inbound_shipment_invoices
  DROP COLUMN IF EXISTS invoice_type;

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_invoices_type_id
  ON public.inbound_shipment_invoices(invoice_type_id);

COMMIT;