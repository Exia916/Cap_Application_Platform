BEGIN;

-- ---------------------------------------------------------------------------
-- Inbound Shipment Forwarders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inbound_shipment_forwarders (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.inbound_shipment_forwarders (
  id,
  code,
  label,
  sort_order,
  is_active
)
VALUES
  (1, 'APEX', 'Apex', 10, true),
  (2, 'FTN', 'FTN', 20, true),
  (3, 'SCARBROUGH', 'Scarbrough', 30, true),
  (4, 'FEDEX_ECONOMY', 'FedEx Economy', 40, true),
  (5, 'FEDEX_PRIORITY', 'FedEx Priority', 50, true),
  (6, 'MC_EXPRESS', 'MC Express', 60, true),
  (7, 'DDP', 'DDP', 70, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

SELECT setval(
  pg_get_serial_sequence('public.inbound_shipment_forwarders', 'id'),
  COALESCE((SELECT MAX(id) FROM public.inbound_shipment_forwarders), 1),
  true
);

-- ---------------------------------------------------------------------------
-- Inbound Shipment Types
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inbound_shipment_types (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.inbound_shipment_types (
  id,
  code,
  label,
  sort_order,
  is_active
)
VALUES
  (1, 'LCL', 'LCL', 10, true),
  (2, 'FCL', 'FCL', 20, true),
  (3, 'DDP', 'DDP', 30, true),
  (4, 'AIR_FOB', 'Air FOB', 40, true),
  (5, 'AIR_DDP_DIRECT', 'Air DDP Direct', 50, true),
  (6, 'AIR_DDP_MO', 'Air DDP MO', 60, true),
  (7, 'AIR_CARGO', 'Air Cargo', 70, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

SELECT setval(
  pg_get_serial_sequence('public.inbound_shipment_types', 'id'),
  COALESCE((SELECT MAX(id) FROM public.inbound_shipment_types), 1),
  true
);

-- ---------------------------------------------------------------------------
-- Add normalized lookup references and tariff percentage to inbound shipments
-- ---------------------------------------------------------------------------

ALTER TABLE public.inbound_shipments
  ADD COLUMN IF NOT EXISTS forwarder_id integer NULL,
  ADD COLUMN IF NOT EXISTS shipment_type_id integer NULL,
  ADD COLUMN IF NOT EXISTS tariff_percentage numeric(5, 2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inbound_shipments_tariff_percentage_chk'
  ) THEN
    ALTER TABLE public.inbound_shipments
      ADD CONSTRAINT inbound_shipments_tariff_percentage_chk
      CHECK (
        tariff_percentage IS NULL
        OR tariff_percentage >= 0
      );
  END IF;
END $$;

-- Backfill forwarder_id from the existing legacy text forwarder field.
-- This keeps old data usable while moving new saves to the lookup id.

UPDATE public.inbound_shipments s
SET forwarder_id = f.id
FROM public.inbound_shipment_forwarders f
WHERE s.forwarder_id IS NULL
  AND NULLIF(TRIM(s.forwarder), '') IS NOT NULL
  AND (
    UPPER(TRIM(s.forwarder)) = UPPER(f.code)
    OR UPPER(TRIM(s.forwarder)) = UPPER(f.label)
    OR REGEXP_REPLACE(UPPER(TRIM(s.forwarder)), '[^A-Z0-9]+', '_', 'g') = f.code
  );

-- Backfill shipment_type_id from the existing legacy text shipment_type field.
-- This keeps old data usable while moving new saves to the lookup id.

UPDATE public.inbound_shipments s
SET shipment_type_id = t.id
FROM public.inbound_shipment_types t
WHERE s.shipment_type_id IS NULL
  AND NULLIF(TRIM(s.shipment_type), '') IS NOT NULL
  AND (
    UPPER(TRIM(s.shipment_type)) = UPPER(t.code)
    OR UPPER(TRIM(s.shipment_type)) = UPPER(t.label)
    OR REGEXP_REPLACE(UPPER(TRIM(s.shipment_type)), '[^A-Z0-9]+', '_', 'g') = t.code
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inbound_shipments_forwarder'
  ) THEN
    ALTER TABLE public.inbound_shipments
      ADD CONSTRAINT fk_inbound_shipments_forwarder
      FOREIGN KEY (forwarder_id)
      REFERENCES public.inbound_shipment_forwarders(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_inbound_shipments_shipment_type'
  ) THEN
    ALTER TABLE public.inbound_shipments
      ADD CONSTRAINT fk_inbound_shipments_shipment_type
      FOREIGN KEY (shipment_type_id)
      REFERENCES public.inbound_shipment_types(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_forwarder_id
  ON public.inbound_shipments(forwarder_id);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_shipment_type_id
  ON public.inbound_shipments(shipment_type_id);

-- ---------------------------------------------------------------------------
-- Shared attachment categories
-- ---------------------------------------------------------------------------
-- This allows one record to have separate attachment buckets, for example:
--   general
--   purchase_order
--
-- Existing attachments are categorized as general.
-- The old filename uniqueness rule is replaced so the same filename can exist
-- once in General Attachments and once in Purchase Order Attachments.

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS attachment_category text NOT NULL DEFAULT 'general';

UPDATE public.attachments
SET attachment_category = 'general'
WHERE NULLIF(TRIM(attachment_category), '') IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attachments_attachment_category_not_blank_chk'
  ) THEN
    ALTER TABLE public.attachments
      ADD CONSTRAINT attachments_attachment_category_not_blank_chk
      CHECK (NULLIF(TRIM(attachment_category), '') IS NOT NULL);
  END IF;
END $$;

DROP INDEX IF EXISTS public.ux_attachments_entity_filename_active;

CREATE UNIQUE INDEX IF NOT EXISTS ux_attachments_entity_category_filename_active
  ON public.attachments (
    entity_type,
    entity_id,
    attachment_category,
    lower(original_file_name)
  )
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_attachments_entity_category_created
  ON public.attachments (
    entity_type,
    entity_id,
    attachment_category,
    created_at DESC,
    id DESC
  );

COMMIT;