-- db/migrations/021_inbound_shipments.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS public.inbound_shipment_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS public.inbound_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inbound_shipment_number text NOT NULL UNIQUE
    DEFAULT ('IS-' || lpad(nextval('public.inbound_shipment_number_seq')::text, 6, '0')),

  status text NOT NULL DEFAULT 'Draft',
  mbl_number text NULL,
  hbl_number text NULL,
  container_number text NULL,
  seal_number text NULL,
  port text NULL,
  carrier text NULL,
  forwarder text NULL,
  shipment_type text NULL,
  container_destination text NOT NULL,
  etd date NULL,
  eta date NULL,
  carton_count integer NULL,
  notes text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,

  is_voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz NULL,
  voided_by text NULL,
  void_reason text NULL,

  CONSTRAINT inbound_shipments_status_chk CHECK (
    status IN (
      'Draft',
      'Awaiting Departure',
      'In Transit',
      'Arrived at Port',
      'Customs Hold',
      'Customs Cleared',
      'Delivered',
      'Received / Closed'
    )
  ),

  CONSTRAINT inbound_shipments_carton_count_chk CHECK (
    carton_count IS NULL OR carton_count >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.inbound_shipment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inbound_shipment_id uuid NOT NULL
    REFERENCES public.inbound_shipments(id)
    ON DELETE CASCADE,

  po_number text NULL,
  customer_id bigint NULL
    REFERENCES public.design_workflow_customers(id)
    ON DELETE SET NULL,
  customer_name text NULL,
  logo text NULL,
  tracking text NULL,
  line_destination text NULL,
  quantity integer NULL,
  carton_count integer NULL,
  notes text NULL,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inbound_shipment_lines_quantity_chk CHECK (
    quantity IS NULL OR quantity >= 0
  ),

  CONSTRAINT inbound_shipment_lines_carton_count_chk CHECK (
    carton_count IS NULL OR carton_count >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.inbound_shipment_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  inbound_shipment_id uuid NOT NULL
    REFERENCES public.inbound_shipments(id)
    ON DELETE CASCADE,

  invoice_number text NOT NULL,
  invoice_type text NULL,
  invoice_date date NULL,
  amount numeric(12, 2) NULL,
  notes text NULL,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inbound_shipment_invoices_type_chk CHECK (
    invoice_type IS NULL OR invoice_type IN (
      'Commercial Invoice',
      'Freight Invoice',
      'Duty Invoice',
      'Tariff Invoice',
      'Other'
    )
  ),

  CONSTRAINT inbound_shipment_invoices_amount_chk CHECK (
    amount IS NULL OR amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_status
  ON public.inbound_shipments(status);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_eta
  ON public.inbound_shipments(eta);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_etd
  ON public.inbound_shipments(etd);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_container_number
  ON public.inbound_shipments(container_number);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_mbl_number
  ON public.inbound_shipments(mbl_number);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_hbl_number
  ON public.inbound_shipments(hbl_number);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_destination
  ON public.inbound_shipments(container_destination);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_voided
  ON public.inbound_shipments(is_voided);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_lines_shipment
  ON public.inbound_shipment_lines(inbound_shipment_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_lines_po
  ON public.inbound_shipment_lines(po_number);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_lines_customer_id
  ON public.inbound_shipment_lines(customer_id);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_lines_customer_name
  ON public.inbound_shipment_lines(customer_name);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_lines_destination
  ON public.inbound_shipment_lines(line_destination);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_invoices_shipment
  ON public.inbound_shipment_invoices(inbound_shipment_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_inbound_shipment_invoices_number
  ON public.inbound_shipment_invoices(invoice_number);