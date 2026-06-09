// lib/repositories/inboundShipmentRepo.ts

import { db } from "@/lib/db";
import {
  buildVoidedWhereClause,
  joinWhere,
  pushWhere,
} from "@/lib/repositories/_shared/repoFilters";
import {
  resolveVoidMode,
  type StandardRepoOptions,
} from "@/lib/repositories/_shared/repoTypes";
import { voidRecord } from "@/lib/repositories/_shared/voiding";
import {
  INBOUND_SHIPMENT_ENTITY_TYPE,
  type InboundShipmentLookupOption,
} from "@/lib/inboundShipments/constants";

type Queryable = {
  query: <T = any>(
    sql: string,
    params?: any[]
  ) => Promise<{ rows: T[]; rowCount: number }>;
};

export type SortDir = "asc" | "desc";

const STATUS_TABLE = "public.inbound_shipment_statuses";
const INVOICE_TYPE_TABLE = "public.inbound_shipment_invoice_types";
const FORWARDER_TABLE = "public.inbound_shipment_forwarders";
const SHIPMENT_TYPE_TABLE = "public.inbound_shipment_types";

type LookupTableName =
  | typeof STATUS_TABLE
  | typeof INVOICE_TYPE_TABLE
  | typeof FORWARDER_TABLE
  | typeof SHIPMENT_TYPE_TABLE;

export type InboundShipmentLine = {
  id: string;
  inboundShipmentId: string;
  poNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  logo: string | null;
  tracking: string | null;

  /**
   * Legacy field. Line Destination has been removed from the active UI.
   * Kept here only so older API consumers do not break if they still read it.
   */
  lineDestination: string | null;

  quantity: number | null;
  cartonCount: number | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type InboundShipmentInvoice = {
  id: string;
  inboundShipmentId: string;
  invoiceNumber: string;

  invoiceTypeId: number | null;
  invoiceTypeCode: string | null;
  invoiceTypeLabel: string | null;

  /**
   * Compatibility alias for older UI code.
   * Prefer invoiceTypeLabel going forward.
   */
  invoiceType: string | null;

  invoiceDate: string | null;
  amount: number | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type InboundShipment = {
  id: string;
  inboundShipmentNumber: string;

  statusId: number;
  statusCode: string;
  statusLabel: string;

  /**
   * Compatibility alias for older UI/list code.
   * Prefer statusLabel going forward.
   */
  status: string;

  mblNumber: string | null;
  hblNumber: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  port: string | null;
  carrier: string | null;

  forwarderId: number | null;
  forwarderCode: string | null;
  forwarderLabel: string | null;

  /**
   * Compatibility alias for older UI/list code.
   * Prefer forwarderLabel going forward.
   */
  forwarder: string | null;

  shipmentTypeId: number | null;
  shipmentTypeCode: string | null;
  shipmentTypeLabel: string | null;

  /**
   * Compatibility alias for older UI/list code.
   * Prefer shipmentTypeLabel going forward.
   */
  shipmentType: string | null;

  containerDestination: string;
  etd: string | null;
  eta: string | null;
  cartonCount: number | null;
  tariffPercentage: number | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type InboundShipmentDetail = InboundShipment & {
  lines: InboundShipmentLine[];
  invoices: InboundShipmentInvoice[];
};

export type InboundShipmentSummaryRow = InboundShipment & {
  lineCount: number;
  invoiceCount: number;
};

export type InboundShipmentLineInput = {
  poNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  logo?: string | null;
  tracking?: string | null;

  /**
   * Legacy input. Ignored going forward because Line Destination was removed.
   */
  lineDestination?: string | null;

  quantity?: number | string | null;
  cartonCount?: number | string | null;
  notes?: string | null;
  sortOrder?: number;
};

export type InboundShipmentInvoiceInput = {
  invoiceNumber?: string | null;

  /**
   * Preferred field going forward.
   */
  invoiceTypeId?: number | string | null;

  /**
   * Compatibility fields for old payloads or temporary UI.
   */
  invoiceType?: string | null;
  invoiceTypeCode?: string | null;
  invoiceTypeLabel?: string | null;

  invoiceDate?: string | null;
  amount?: number | string | null;
  notes?: string | null;
  sortOrder?: number;
};

export type InboundShipmentWriteInput = {
  /**
   * Preferred field going forward.
   */
  statusId?: number | string | null;

  /**
   * Compatibility fields for old payloads or temporary UI.
   */
  status?: string | null;
  statusCode?: string | null;
  statusLabel?: string | null;

  mblNumber?: string | null;
  hblNumber?: string | null;
  containerNumber?: string | null;
  sealNumber?: string | null;
  port?: string | null;
  carrier?: string | null;

  /**
   * Preferred field going forward.
   */
  forwarderId?: number | string | null;

  /**
   * Compatibility fields for old payloads or temporary UI.
   */
  forwarder?: string | null;
  forwarderCode?: string | null;
  forwarderLabel?: string | null;

  /**
   * Preferred field going forward.
   */
  shipmentTypeId?: number | string | null;

  /**
   * Compatibility fields for old payloads or temporary UI.
   */
  shipmentType?: string | null;
  shipmentTypeCode?: string | null;
  shipmentTypeLabel?: string | null;

  containerDestination: string;
  etd?: string | null;
  eta?: string | null;
  cartonCount?: number | string | null;
  tariffPercentage?: number | string | null;
  notes?: string | null;
  lines?: InboundShipmentLineInput[];
  invoices?: InboundShipmentInvoiceInput[];
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type InboundShipmentListFilters = StandardRepoOptions & {
  q?: string | null;

  statusId?: number | string | null;
  status?: string | null;

  containerNumber?: string | null;
  mblNumber?: string | null;
  hblNumber?: string | null;
  port?: string | null;
  carrier?: string | null;
  forwarder?: string | null;
  shipmentType?: string | null;
  containerDestination?: string | null;
  etdFrom?: string | null;
  etdTo?: string | null;
  etaFrom?: string | null;
  etaTo?: string | null;
  customer?: string | null;
  poNumber?: string | null;
  sortBy?: string | null;
  sortDir?: SortDir | null;
  limit?: number;
  offset?: number;
};

export type PagedInboundShipmentResult = {
  rows: InboundShipmentSummaryRow[];
  total: number;
  pageSize: number;
  offset: number;
};

export type CustomerLookupOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  isActive: boolean;
};

type NormalizedLine = {
  poNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  logo: string | null;
  tracking: string | null;
  quantity: number | null;
  cartonCount: number | null;
  notes: string | null;
  sortOrder: number;
};

type NormalizedInvoice = {
  invoiceNumber: string;
  invoiceTypeId: number | null;
  invoiceDate: string | null;
  amount: number | null;
  notes: string | null;
  sortOrder: number;
};

type ResolvedOptionalLookup = {
  id: number | null;
  code: string | null;
  label: string | null;
  legacyText: string | null;
};

type NormalizedInput = {
  statusId: number;
  statusCode: string;
  statusLabel: string;
  mblNumber: string | null;
  hblNumber: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  port: string | null;
  carrier: string | null;

  forwarderId: number | null;
  forwarderCode: string | null;
  forwarderLabel: string | null;
  forwarderLegacyText: string | null;

  shipmentTypeId: number | null;
  shipmentTypeCode: string | null;
  shipmentTypeLabel: string | null;
  shipmentTypeLegacyText: string | null;

  containerDestination: string;
  etd: string | null;
  eta: string | null;
  cartonCount: number | null;
  tariffPercentage: number | null;
  notes: string | null;
  lines: NormalizedLine[];
  invoices: NormalizedInvoice[];
  changedBy: string | null;
  changedByUserId: string | null;
  changedByEmployeeNumber: number | null;
};

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                               */
/* -------------------------------------------------------------------------- */

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanRequiredText(value: unknown, label: string): string {
  const s = String(value ?? "").trim();
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

function cleanDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error("Dates must be in YYYY-MM-DD format.");
  }

  return s;
}

function cleanNonNegativeInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return n;
}

function cleanNonNegativeNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }

  return n;
}

function cleanNonNegativeDecimal(
  value: unknown,
  label: string,
  maxDecimals = 2
): number | null {
  if (value === null || value === undefined || value === "") return null;

  const raw = String(value).trim().replace(/%$/, "").trim();
  if (!raw) return null;

  const decimalRegex = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);

  if (!decimalRegex.test(raw)) {
    throw new Error(`${label} must be a non-negative number with up to ${maxDecimals} decimals.`);
  }

  const n = Number(raw);

  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }

  return n;
}

function cleanPositiveInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a valid lookup value.`);
  }

  return n;
}

function tokenToNumericId(token: string): number | null {
  if (!/^\d+$/.test(token)) return null;

  const n = Number(token);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function getLookupById(
  queryable: Queryable,
  tableName: LookupTableName,
  id: number
): Promise<InboundShipmentLookupOption | null> {
  const { rows } = await queryable.query<InboundShipmentLookupOption>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM ${tableName}
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

async function getLookupByToken(
  queryable: Queryable,
  tableName: LookupTableName,
  token: string
): Promise<InboundShipmentLookupOption | null> {
  const numericId = tokenToNumericId(token);

  const { rows } = await queryable.query<InboundShipmentLookupOption>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM ${tableName}
    WHERE
      ($2::integer IS NOT NULL AND id = $2::integer)
      OR UPPER(code) = UPPER($1)
      OR UPPER(label) = UPPER($1)
    ORDER BY
      is_active DESC,
      sort_order ASC,
      id ASC
    LIMIT 1
    `,
    [token, numericId]
  );

  return rows[0] ?? null;
}

async function resolveStatus(
  queryable: Queryable,
  input: InboundShipmentWriteInput
): Promise<InboundShipmentLookupOption> {
  const statusId = cleanPositiveInt(input.statusId, "Status");

  if (statusId != null) {
    const found = await getLookupById(queryable, STATUS_TABLE, statusId);
    if (!found) throw new Error("Invalid inbound shipment status.");
    return found;
  }

  const statusToken =
    cleanText(input.statusCode) ?? cleanText(input.statusLabel) ?? cleanText(input.status);

  if (!statusToken) {
    throw new Error("Status is required.");
  }

  const found = await getLookupByToken(queryable, STATUS_TABLE, statusToken);

  if (!found) {
    throw new Error("Invalid inbound shipment status.");
  }

  return found;
}

async function resolveInvoiceTypeId(
  queryable: Queryable,
  input: InboundShipmentInvoiceInput
): Promise<number | null> {
  const invoiceTypeId = cleanPositiveInt(input.invoiceTypeId, "Invoice Type");

  if (invoiceTypeId != null) {
    const found = await getLookupById(queryable, INVOICE_TYPE_TABLE, invoiceTypeId);
    if (!found) throw new Error("Invalid invoice type.");
    return found.id;
  }

  const token =
    cleanText(input.invoiceTypeCode) ??
    cleanText(input.invoiceTypeLabel) ??
    cleanText(input.invoiceType);

  if (!token) return null;

  const found = await getLookupByToken(queryable, INVOICE_TYPE_TABLE, token);

  if (!found) {
    throw new Error("Invalid invoice type.");
  }

  return found.id;
}

async function resolveOptionalLookup(
  queryable: Queryable,
  tableName: LookupTableName,
  idValue: unknown,
  tokens: unknown[],
  label: string
): Promise<ResolvedOptionalLookup> {
  const lookupId = cleanPositiveInt(idValue, label);

  if (lookupId != null) {
    const found = await getLookupById(queryable, tableName, lookupId);
    if (!found) throw new Error(`Invalid ${label.toLowerCase()}.`);

    return {
      id: found.id,
      code: found.code,
      label: found.label,
      legacyText: found.label,
    };
  }

  const token = tokens.map((x) => cleanText(x)).find((x): x is string => Boolean(x));

  if (!token) {
    return {
      id: null,
      code: null,
      label: null,
      legacyText: null,
    };
  }

  const found = await getLookupByToken(queryable, tableName, token);

  if (!found) {
    return {
      id: null,
      code: null,
      label: null,
      legacyText: token,
    };
  }

  return {
    id: found.id,
    code: found.code,
    label: found.label,
    legacyText: found.label,
  };
}

async function normalizeInput(
  queryable: Queryable,
  input: InboundShipmentWriteInput
): Promise<NormalizedInput> {
  const status = await resolveStatus(queryable, input);

  const forwarder = await resolveOptionalLookup(
    queryable,
    FORWARDER_TABLE,
    input.forwarderId,
    [input.forwarderCode, input.forwarderLabel, input.forwarder],
    "Forwarder"
  );

  const shipmentType = await resolveOptionalLookup(
    queryable,
    SHIPMENT_TYPE_TABLE,
    input.shipmentTypeId,
    [input.shipmentTypeCode, input.shipmentTypeLabel, input.shipmentType],
    "Shipment Type"
  );

  const containerDestination = cleanRequiredText(
    input.containerDestination,
    "Container Destination"
  );

  const lines = (input.lines ?? [])
    .map((line, idx) => ({
      poNumber: cleanText(line.poNumber),
      customerId: cleanText(line.customerId),
      customerName: cleanText(line.customerName),
      logo: cleanText(line.logo),
      tracking: cleanText(line.tracking),
      quantity: cleanNonNegativeInt(line.quantity, "Quantity"),
      cartonCount: cleanNonNegativeInt(line.cartonCount, "Line Carton Count"),
      notes: cleanText(line.notes),
      sortOrder: Number.isInteger(line.sortOrder) ? Number(line.sortOrder) : idx,
    }))
    .filter((line) =>
      Boolean(
        line.poNumber ||
          line.customerId ||
          line.customerName ||
          line.logo ||
          line.tracking ||
          line.quantity != null ||
          line.cartonCount != null ||
          line.notes
      )
    );

  for (const line of lines) {
    if (!line.poNumber) {
      throw new Error("PO # is required for each line row that is entered.");
    }

    if (!line.customerName) {
      throw new Error("Customer is required for each line row that is entered.");
    }
  }

  if (status.code !== "DRAFT" && lines.length === 0) {
    throw new Error("At least one line row is required after Draft.");
  }

  const invoices: NormalizedInvoice[] = [];

  for (let idx = 0; idx < (input.invoices ?? []).length; idx += 1) {
    const invoice = input.invoices![idx];

    const invoiceNumber = cleanText(invoice.invoiceNumber);
    const invoiceTypeId = await resolveInvoiceTypeId(queryable, invoice);
    const invoiceDate = cleanDate(invoice.invoiceDate);
    const amount = cleanNonNegativeNumber(invoice.amount, "Invoice Amount");
    const notes = cleanText(invoice.notes);

    const hasAnyValue = Boolean(
      invoiceNumber || invoiceTypeId || invoiceDate || amount != null || notes
    );

    if (!hasAnyValue) continue;

    if (!invoiceNumber) {
      throw new Error("Invoice # is required for each invoice row that is entered.");
    }

    invoices.push({
      invoiceNumber,
      invoiceTypeId,
      invoiceDate,
      amount,
      notes,
      sortOrder: Number.isInteger(invoice.sortOrder) ? Number(invoice.sortOrder) : idx,
    });
  }

  return {
    statusId: status.id,
    statusCode: status.code,
    statusLabel: status.label,
    mblNumber: cleanText(input.mblNumber),
    hblNumber: cleanText(input.hblNumber),
    containerNumber: cleanText(input.containerNumber),
    sealNumber: cleanText(input.sealNumber),
    port: cleanText(input.port),
    carrier: cleanText(input.carrier),

    forwarderId: forwarder.id,
    forwarderCode: forwarder.code,
    forwarderLabel: forwarder.label,
    forwarderLegacyText: forwarder.legacyText,

    shipmentTypeId: shipmentType.id,
    shipmentTypeCode: shipmentType.code,
    shipmentTypeLabel: shipmentType.label,
    shipmentTypeLegacyText: shipmentType.legacyText,

    containerDestination,
    etd: cleanDate(input.etd),
    eta: cleanDate(input.eta),
    cartonCount: cleanNonNegativeInt(input.cartonCount, "Carton Count"),
    tariffPercentage: cleanNonNegativeDecimal(input.tariffPercentage, "Tariff Percentage", 2),
    notes: cleanText(input.notes),
    lines,
    invoices,
    changedBy: cleanText(input.changedBy),
    changedByUserId: cleanText(input.changedByUserId),
    changedByEmployeeNumber: cleanNonNegativeInt(
      input.changedByEmployeeNumber,
      "Employee Number"
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* SELECT HELPERS                                                              */
/* -------------------------------------------------------------------------- */

function shipmentSelectSql() {
  return `
    SELECT
      s.id,
      s.inbound_shipment_number AS "inboundShipmentNumber",

      s.status_id AS "statusId",
      st.code AS "statusCode",
      st.label AS "statusLabel",
      st.label AS "status",

      s.mbl_number AS "mblNumber",
      s.hbl_number AS "hblNumber",
      s.container_number AS "containerNumber",
      s.seal_number AS "sealNumber",
      s.port,
      s.carrier,

      s.forwarder_id AS "forwarderId",
      fw.code AS "forwarderCode",
      fw.label AS "forwarderLabel",
      COALESCE(fw.label, s.forwarder) AS "forwarder",

      s.shipment_type_id AS "shipmentTypeId",
      typ.code AS "shipmentTypeCode",
      typ.label AS "shipmentTypeLabel",
      COALESCE(typ.label, s.shipment_type) AS "shipmentType",

      s.container_destination AS "containerDestination",
      s.etd,
      s.eta,
      s.carton_count AS "cartonCount",
      s.tariff_percentage::float AS "tariffPercentage",
      s.notes,
      s.created_at AS "createdAt",
      s.created_by AS "createdBy",
      s.updated_at AS "updatedAt",
      s.updated_by AS "updatedBy",
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason"
    FROM public.inbound_shipments s
    JOIN public.inbound_shipment_statuses st
      ON st.id = s.status_id
    LEFT JOIN public.inbound_shipment_forwarders fw
      ON fw.id = s.forwarder_id
    LEFT JOIN public.inbound_shipment_types typ
      ON typ.id = s.shipment_type_id
  `;
}

function lineSelectSql() {
  return `
    SELECT
      l.id,
      l.inbound_shipment_id AS "inboundShipmentId",
      l.po_number AS "poNumber",
      l.customer_id::text AS "customerId",
      l.customer_name AS "customerName",
      l.logo,
      l.tracking,
      l.line_destination AS "lineDestination",
      l.quantity,
      l.carton_count AS "cartonCount",
      l.notes,
      l.sort_order AS "sortOrder",
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt"
    FROM public.inbound_shipment_lines l
  `;
}

function invoiceSelectSql() {
  return `
    SELECT
      i.id,
      i.inbound_shipment_id AS "inboundShipmentId",
      i.invoice_number AS "invoiceNumber",

      i.invoice_type_id AS "invoiceTypeId",
      it.code AS "invoiceTypeCode",
      it.label AS "invoiceTypeLabel",
      it.label AS "invoiceType",

      i.invoice_date AS "invoiceDate",
      i.amount::float AS "amount",
      i.notes,
      i.sort_order AS "sortOrder",
      i.created_at AS "createdAt",
      i.updated_at AS "updatedAt"
    FROM public.inbound_shipment_invoices i
    LEFT JOIN public.inbound_shipment_invoice_types it
      ON it.id = i.invoice_type_id
  `;
}

/* -------------------------------------------------------------------------- */
/* LIST FILTERING                                                              */
/* -------------------------------------------------------------------------- */

function addIlikeFilter(
  where: string[],
  params: any[],
  columnSql: string,
  value: string | null | undefined
) {
  const v = String(value ?? "").trim();
  if (!v) return;

  params.push(`%${v}%`);
  where.push(`${columnSql} ILIKE $${params.length}`);
}

function addStatusFilter(
  where: string[],
  params: any[],
  statusId?: number | string | null,
  status?: string | null
) {
  const id = cleanPositiveInt(statusId, "Status");
  if (id != null) {
    params.push(id);
    pushWhere(where, `s.status_id = $${params.length}`);
    return;
  }

  const value = String(status ?? "").trim();
  if (!value) return;

  const numericToken = tokenToNumericId(value);
  if (numericToken != null) {
    params.push(numericToken);
    pushWhere(where, `s.status_id = $${params.length}`);
    return;
  }

  params.push(`%${value}%`);
  pushWhere(
    where,
    `
    (
      st.code ILIKE $${params.length}
      OR st.label ILIKE $${params.length}
    )
    `
  );
}

function buildWhere(filters: InboundShipmentListFilters) {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(filters)));

  const q = String(filters.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;

    pushWhere(
      where,
      `
      (
        s.inbound_shipment_number ILIKE ${p}
        OR st.code ILIKE ${p}
        OR st.label ILIKE ${p}
        OR COALESCE(s.mbl_number, '') ILIKE ${p}
        OR COALESCE(s.hbl_number, '') ILIKE ${p}
        OR COALESCE(s.container_number, '') ILIKE ${p}
        OR COALESCE(s.seal_number, '') ILIKE ${p}
        OR COALESCE(s.port, '') ILIKE ${p}
        OR COALESCE(s.carrier, '') ILIKE ${p}
        OR COALESCE(fw.code, '') ILIKE ${p}
        OR COALESCE(fw.label, '') ILIKE ${p}
        OR COALESCE(s.forwarder, '') ILIKE ${p}
        OR COALESCE(typ.code, '') ILIKE ${p}
        OR COALESCE(typ.label, '') ILIKE ${p}
        OR COALESCE(s.shipment_type, '') ILIKE ${p}
        OR COALESCE(s.container_destination, '') ILIKE ${p}
        OR COALESCE(s.notes, '') ILIKE ${p}
        OR EXISTS (
          SELECT 1
          FROM public.inbound_shipment_lines lx
          WHERE lx.inbound_shipment_id = s.id
            AND (
              COALESCE(lx.po_number, '') ILIKE ${p}
              OR COALESCE(lx.customer_name, '') ILIKE ${p}
              OR COALESCE(lx.logo, '') ILIKE ${p}
              OR COALESCE(lx.tracking, '') ILIKE ${p}
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.inbound_shipment_invoices ix
          LEFT JOIN public.inbound_shipment_invoice_types itx
            ON itx.id = ix.invoice_type_id
          WHERE ix.inbound_shipment_id = s.id
            AND (
              COALESCE(ix.invoice_number, '') ILIKE ${p}
              OR COALESCE(itx.code, '') ILIKE ${p}
              OR COALESCE(itx.label, '') ILIKE ${p}
            )
        )
      )
      `
    );
  }

  addStatusFilter(where, params, filters.statusId, filters.status);

  addIlikeFilter(where, params, "s.container_number", filters.containerNumber);
  addIlikeFilter(where, params, "s.mbl_number", filters.mblNumber);
  addIlikeFilter(where, params, "s.hbl_number", filters.hblNumber);
  addIlikeFilter(where, params, "s.port", filters.port);
  addIlikeFilter(where, params, "s.carrier", filters.carrier);
  addIlikeFilter(where, params, "COALESCE(fw.label, s.forwarder, '')", filters.forwarder);
  addIlikeFilter(
    where,
    params,
    "COALESCE(typ.label, s.shipment_type, '')",
    filters.shipmentType
  );
  addIlikeFilter(where, params, "s.container_destination", filters.containerDestination);

  if (filters.etdFrom) {
    params.push(filters.etdFrom);
    pushWhere(where, `s.etd >= $${params.length}::date`);
  }

  if (filters.etdTo) {
    params.push(filters.etdTo);
    pushWhere(where, `s.etd <= $${params.length}::date`);
  }

  if (filters.etaFrom) {
    params.push(filters.etaFrom);
    pushWhere(where, `s.eta >= $${params.length}::date`);
  }

  if (filters.etaTo) {
    params.push(filters.etaTo);
    pushWhere(where, `s.eta <= $${params.length}::date`);
  }

  const customer = String(filters.customer ?? "").trim();
  if (customer) {
    params.push(`%${customer}%`);
    pushWhere(
      where,
      `
      EXISTS (
        SELECT 1
        FROM public.inbound_shipment_lines lc
        WHERE lc.inbound_shipment_id = s.id
          AND COALESCE(lc.customer_name, '') ILIKE $${params.length}
      )
      `
    );
  }

  const poNumber = String(filters.poNumber ?? "").trim();
  if (poNumber) {
    params.push(`%${poNumber}%`);
    pushWhere(
      where,
      `
      EXISTS (
        SELECT 1
        FROM public.inbound_shipment_lines lp
        WHERE lp.inbound_shipment_id = s.id
          AND COALESCE(lp.po_number, '') ILIKE $${params.length}
      )
      `
    );
  }

  return {
    whereSql: joinWhere(where),
    params,
  };
}

function resolveOrderBy(sortBy?: string | null, sortDir?: SortDir | null) {
  const dir = String(sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const map: Record<string, string> = {
    inboundShipmentNumber: `s.inbound_shipment_number ${dir}`,
    status: `st.label ${dir}`,
    statusLabel: `st.label ${dir}`,
    statusCode: `st.code ${dir}`,
    containerNumber: `s.container_number ${dir} NULLS LAST`,
    mblNumber: `s.mbl_number ${dir} NULLS LAST`,
    hblNumber: `s.hbl_number ${dir} NULLS LAST`,
    port: `s.port ${dir} NULLS LAST`,
    carrier: `s.carrier ${dir} NULLS LAST`,
    forwarder: `COALESCE(fw.label, s.forwarder) ${dir} NULLS LAST`,
    shipmentType: `COALESCE(typ.label, s.shipment_type) ${dir} NULLS LAST`,
    containerDestination: `s.container_destination ${dir}`,
    etd: `s.etd ${dir} NULLS LAST`,
    eta: `s.eta ${dir} NULLS LAST`,
    cartonCount: `s.carton_count ${dir} NULLS LAST`,
    tariffPercentage: `s.tariff_percentage ${dir} NULLS LAST`,
    lineCount: `"lineCount" ${dir}`,
    invoiceCount: `"invoiceCount" ${dir}`,
    createdAt: `s.created_at ${dir}`,
    updatedAt: `s.updated_at ${dir}`,
  };

  if (sortBy && map[sortBy]) {
    return `${map[sortBy]}, s.created_at DESC, s.id DESC`;
  }

  return `
    CASE WHEN st.code = 'RECEIVED_CLOSED' THEN 1 ELSE 0 END ASC,
    s.eta ASC NULLS LAST,
    s.created_at DESC,
    s.id DESC
  `;
}

/* -------------------------------------------------------------------------- */
/* ACTIVITY                                                                    */
/* -------------------------------------------------------------------------- */

async function logActivity(
  queryable: Queryable,
  input: {
    entityId: string;
    eventType: string;
    fieldName?: string | null;
    previousValue?: unknown;
    newValue?: unknown;
    message: string;
    userId?: string | null;
    userName?: string | null;
    employeeNumber?: number | null;
  }
) {
  await queryable.query(
    `
    INSERT INTO public.activity_history (
      entity_type,
      entity_id,
      event_type,
      field_name,
      previous_value,
      new_value,
      message,
      module,
      user_id,
      user_name,
      employee_number
    )
    VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11)
    `,
    [
      INBOUND_SHIPMENT_ENTITY_TYPE,
      input.entityId,
      input.eventType,
      input.fieldName ?? null,
      input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
      input.newValue === undefined ? null : JSON.stringify(input.newValue),
      input.message,
      "Logistics / Inbound Shipments",
      input.userId ?? null,
      input.userName ?? null,
      input.employeeNumber ?? null,
    ]
  );
}

/* -------------------------------------------------------------------------- */
/* CHILD WRITES                                                                */
/* -------------------------------------------------------------------------- */

async function insertLines(
  queryable: Queryable,
  inboundShipmentId: string,
  lines: NormalizedLine[]
) {
  for (const line of lines) {
    await queryable.query(
      `
      INSERT INTO public.inbound_shipment_lines (
        inbound_shipment_id,
        po_number,
        customer_id,
        customer_name,
        logo,
        tracking,
        quantity,
        carton_count,
        notes,
        sort_order
      )
      VALUES ($1,$2,$3::bigint,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        inboundShipmentId,
        line.poNumber,
        line.customerId,
        line.customerName,
        line.logo,
        line.tracking,
        line.quantity,
        line.cartonCount,
        line.notes,
        line.sortOrder,
      ]
    );
  }
}

async function insertInvoices(
  queryable: Queryable,
  inboundShipmentId: string,
  invoices: NormalizedInvoice[]
) {
  for (const invoice of invoices) {
    await queryable.query(
      `
      INSERT INTO public.inbound_shipment_invoices (
        inbound_shipment_id,
        invoice_number,
        invoice_type_id,
        invoice_date,
        amount,
        notes,
        sort_order
      )
      VALUES ($1,$2,$3,$4::date,$5,$6,$7)
      `,
      [
        inboundShipmentId,
        invoice.invoiceNumber,
        invoice.invoiceTypeId,
        invoice.invoiceDate,
        invoice.amount,
        invoice.notes,
        invoice.sortOrder,
      ]
    );
  }
}

/* -------------------------------------------------------------------------- */
/* LIST / GET                                                                  */
/* -------------------------------------------------------------------------- */

export async function listInboundShipments(
  filters: InboundShipmentListFilters
): Promise<PagedInboundShipmentResult> {
  const pageSize = Math.min(Math.max(Number(filters.limit || 25), 1), 100);
  const offset = Math.max(Number(filters.offset || 0), 0);

  const { whereSql, params } = buildWhere(filters);
  const orderBy = resolveOrderBy(filters.sortBy, filters.sortDir);

  const countResult = await db.query<{ total: number }>(
    `
    SELECT COUNT(DISTINCT s.id)::int AS total
    FROM public.inbound_shipments s
    JOIN public.inbound_shipment_statuses st
      ON st.id = s.status_id
    LEFT JOIN public.inbound_shipment_forwarders fw
      ON fw.id = s.forwarder_id
    LEFT JOIN public.inbound_shipment_types typ
      ON typ.id = s.shipment_type_id
    ${whereSql}
    `,
    params
  );

  const dataParams = [...params, pageSize, offset];

  const { rows } = await db.query<InboundShipmentSummaryRow>(
    `
    SELECT
      s.id,
      s.inbound_shipment_number AS "inboundShipmentNumber",

      s.status_id AS "statusId",
      st.code AS "statusCode",
      st.label AS "statusLabel",
      st.label AS "status",

      s.mbl_number AS "mblNumber",
      s.hbl_number AS "hblNumber",
      s.container_number AS "containerNumber",
      s.seal_number AS "sealNumber",
      s.port,
      s.carrier,

      s.forwarder_id AS "forwarderId",
      fw.code AS "forwarderCode",
      fw.label AS "forwarderLabel",
      COALESCE(fw.label, s.forwarder) AS "forwarder",

      s.shipment_type_id AS "shipmentTypeId",
      typ.code AS "shipmentTypeCode",
      typ.label AS "shipmentTypeLabel",
      COALESCE(typ.label, s.shipment_type) AS "shipmentType",

      s.container_destination AS "containerDestination",
      s.etd,
      s.eta,
      s.carton_count AS "cartonCount",
      s.tariff_percentage::float AS "tariffPercentage",
      s.notes,
      s.created_at AS "createdAt",
      s.created_by AS "createdBy",
      s.updated_at AS "updatedAt",
      s.updated_by AS "updatedBy",
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason",

      COUNT(DISTINCT l.id)::int AS "lineCount",
      COUNT(DISTINCT i.id)::int AS "invoiceCount"
    FROM public.inbound_shipments s
    JOIN public.inbound_shipment_statuses st
      ON st.id = s.status_id
    LEFT JOIN public.inbound_shipment_forwarders fw
      ON fw.id = s.forwarder_id
    LEFT JOIN public.inbound_shipment_types typ
      ON typ.id = s.shipment_type_id
    LEFT JOIN public.inbound_shipment_lines l
      ON l.inbound_shipment_id = s.id
    LEFT JOIN public.inbound_shipment_invoices i
      ON i.inbound_shipment_id = s.id
    ${whereSql}
    GROUP BY s.id, st.id, fw.id, typ.id
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}
    OFFSET $${dataParams.length}
    `,
    dataParams
  );

  return {
    rows,
    total: countResult.rows[0]?.total ?? 0,
    pageSize,
    offset,
  };
}

export async function getInboundShipmentById(
  id: string,
  options?: StandardRepoOptions
): Promise<InboundShipmentDetail | null> {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(options)));

  params.push(id);
  pushWhere(where, `s.id = $${params.length}`);

  const shipmentResult = await db.query<InboundShipment>(
    `
    ${shipmentSelectSql()}
    ${joinWhere(where)}
    LIMIT 1
    `,
    params
  );

  const shipment = shipmentResult.rows[0];
  if (!shipment) return null;

  const [lineResult, invoiceResult] = await Promise.all([
    db.query<InboundShipmentLine>(
      `
      ${lineSelectSql()}
      WHERE l.inbound_shipment_id = $1
      ORDER BY l.sort_order ASC, l.created_at ASC, l.id ASC
      `,
      [id]
    ),
    db.query<InboundShipmentInvoice>(
      `
      ${invoiceSelectSql()}
      WHERE i.inbound_shipment_id = $1
      ORDER BY i.sort_order ASC, i.created_at ASC, i.id ASC
      `,
      [id]
    ),
  ]);

  return {
    ...shipment,
    lines: lineResult.rows,
    invoices: invoiceResult.rows,
  };
}

/* -------------------------------------------------------------------------- */
/* CREATE / UPDATE                                                             */
/* -------------------------------------------------------------------------- */

export async function createInboundShipment(
  input: InboundShipmentWriteInput
): Promise<{ id: string; inboundShipmentNumber: string }> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const normalized = await normalizeInput(client, input);

    const result = await client.query<{
      id: string;
      inboundShipmentNumber: string;
    }>(
      `
      INSERT INTO public.inbound_shipments (
        status_id,
        mbl_number,
        hbl_number,
        container_number,
        seal_number,
        port,
        carrier,
        forwarder_id,
        forwarder,
        shipment_type_id,
        shipment_type,
        container_destination,
        etd,
        eta,
        carton_count,
        tariff_percentage,
        notes,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14::date,$15,$16,$17,$18,$18)
      RETURNING
        id,
        inbound_shipment_number AS "inboundShipmentNumber"
      `,
      [
        normalized.statusId,
        normalized.mblNumber,
        normalized.hblNumber,
        normalized.containerNumber,
        normalized.sealNumber,
        normalized.port,
        normalized.carrier,
        normalized.forwarderId,
        normalized.forwarderLegacyText,
        normalized.shipmentTypeId,
        normalized.shipmentTypeLegacyText,
        normalized.containerDestination,
        normalized.etd,
        normalized.eta,
        normalized.cartonCount,
        normalized.tariffPercentage,
        normalized.notes,
        normalized.changedBy,
      ]
    );

    const created = result.rows[0];
    if (!created) throw new Error("Failed to create inbound shipment.");

    await insertLines(client, created.id, normalized.lines);
    await insertInvoices(client, created.id, normalized.invoices);

    await logActivity(client, {
      entityId: created.id,
      eventType: "created",
      message: `Inbound shipment ${created.inboundShipmentNumber} created.`,
      newValue: {
        inboundShipmentNumber: created.inboundShipmentNumber,
        statusId: normalized.statusId,
        statusCode: normalized.statusCode,
        statusLabel: normalized.statusLabel,
        forwarderId: normalized.forwarderId,
        forwarderCode: normalized.forwarderCode,
        forwarderLabel: normalized.forwarderLabel,
        shipmentTypeId: normalized.shipmentTypeId,
        shipmentTypeCode: normalized.shipmentTypeCode,
        shipmentTypeLabel: normalized.shipmentTypeLabel,
        tariffPercentage: normalized.tariffPercentage,
        lineCount: normalized.lines.length,
        invoiceCount: normalized.invoices.length,
      },
      userId: normalized.changedByUserId,
      userName: normalized.changedBy,
      employeeNumber: normalized.changedByEmployeeNumber,
    });

    await client.query("COMMIT");

    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateInboundShipment(
  id: string,
  input: InboundShipmentWriteInput
): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const normalized = await normalizeInput(client, input);

    const existingResult = await client.query<{
      id: string;
      inbound_shipment_number: string;
      status_id: number;
      status_code: string;
      status_label: string;
      is_voided: boolean;
    }>(
      `
      SELECT
        s.id,
        s.inbound_shipment_number,
        s.status_id,
        st.code AS status_code,
        st.label AS status_label,
        COALESCE(s.is_voided, false) AS is_voided
      FROM public.inbound_shipments s
      JOIN public.inbound_shipment_statuses st
        ON st.id = s.status_id
      WHERE s.id = $1
      FOR UPDATE
      `,
      [id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error("Inbound shipment not found.");
    }

    if (existing.is_voided) {
      throw new Error("Voided inbound shipments cannot be edited.");
    }

    await client.query(
      `
      UPDATE public.inbound_shipments
      SET
        status_id = $2,
        mbl_number = $3,
        hbl_number = $4,
        container_number = $5,
        seal_number = $6,
        port = $7,
        carrier = $8,
        forwarder_id = $9,
        forwarder = $10,
        shipment_type_id = $11,
        shipment_type = $12,
        container_destination = $13,
        etd = $14::date,
        eta = $15::date,
        carton_count = $16,
        tariff_percentage = $17,
        notes = $18,
        updated_at = now(),
        updated_by = $19
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      `,
      [
        id,
        normalized.statusId,
        normalized.mblNumber,
        normalized.hblNumber,
        normalized.containerNumber,
        normalized.sealNumber,
        normalized.port,
        normalized.carrier,
        normalized.forwarderId,
        normalized.forwarderLegacyText,
        normalized.shipmentTypeId,
        normalized.shipmentTypeLegacyText,
        normalized.containerDestination,
        normalized.etd,
        normalized.eta,
        normalized.cartonCount,
        normalized.tariffPercentage,
        normalized.notes,
        normalized.changedBy,
      ]
    );

    await client.query(
      `
      DELETE FROM public.inbound_shipment_lines
      WHERE inbound_shipment_id = $1
      `,
      [id]
    );

    await client.query(
      `
      DELETE FROM public.inbound_shipment_invoices
      WHERE inbound_shipment_id = $1
      `,
      [id]
    );

    await insertLines(client, id, normalized.lines);
    await insertInvoices(client, id, normalized.invoices);

    if (existing.status_id !== normalized.statusId) {
      await logActivity(client, {
        entityId: id,
        eventType: "status_changed",
        fieldName: "status_id",
        previousValue: {
          id: existing.status_id,
          code: existing.status_code,
          label: existing.status_label,
        },
        newValue: {
          id: normalized.statusId,
          code: normalized.statusCode,
          label: normalized.statusLabel,
        },
        message: `Status changed from ${existing.status_label} to ${normalized.statusLabel}.`,
        userId: normalized.changedByUserId,
        userName: normalized.changedBy,
        employeeNumber: normalized.changedByEmployeeNumber,
      });
    }

    await logActivity(client, {
      entityId: id,
      eventType: "updated",
      message: `Inbound shipment ${existing.inbound_shipment_number} updated.`,
      newValue: {
        statusId: normalized.statusId,
        statusCode: normalized.statusCode,
        statusLabel: normalized.statusLabel,
        forwarderId: normalized.forwarderId,
        forwarderCode: normalized.forwarderCode,
        forwarderLabel: normalized.forwarderLabel,
        shipmentTypeId: normalized.shipmentTypeId,
        shipmentTypeCode: normalized.shipmentTypeCode,
        shipmentTypeLabel: normalized.shipmentTypeLabel,
        tariffPercentage: normalized.tariffPercentage,
        lineCount: normalized.lines.length,
        invoiceCount: normalized.invoices.length,
      },
      userId: normalized.changedByUserId,
      userName: normalized.changedBy,
      employeeNumber: normalized.changedByEmployeeNumber,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------- */
/* VOID / UNVOID                                                               */
/* -------------------------------------------------------------------------- */

export async function voidInboundShipment(input: {
  id: string;
  reason?: string | null;
  changedBy: string;
  changedByUserId?: string | null;
  employeeNumber?: number | null;
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const query = async <T = any>(sql: string, params?: any[]) => {
      const result = await client.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
      };
    };

    const result = await voidRecord(query, {
      tableName: "public.inbound_shipments",
      idColumn: "id",
      idValue: input.id,
      userName: input.changedBy,
      reason: input.reason ?? null,
    });

    const row = result.rows[0];
    if (!row) {
      throw new Error("Inbound shipment not found or already voided.");
    }

    await logActivity(client, {
      entityId: input.id,
      eventType: "voided",
      fieldName: "is_voided",
      previousValue: false,
      newValue: true,
      message: input.reason
        ? `Inbound shipment voided. Reason: ${input.reason}`
        : "Inbound shipment voided.",
      userId: input.changedByUserId ?? null,
      userName: input.changedBy,
      employeeNumber: input.employeeNumber ?? null,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function unvoidInboundShipment(input: {
  id: string;
  changedBy: string;
  changedByUserId?: string | null;
  employeeNumber?: number | null;
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE public.inbound_shipments
      SET
        is_voided = false,
        voided_at = NULL,
        voided_by = NULL,
        void_reason = NULL,
        updated_at = now(),
        updated_by = $2
      WHERE id = $1
        AND COALESCE(is_voided, false) = true
      RETURNING *
      `,
      [input.id, input.changedBy]
    );

    if (!result.rows[0]) {
      throw new Error("Inbound shipment not found or is not voided.");
    }

    await logActivity(client, {
      entityId: input.id,
      eventType: "unvoided",
      fieldName: "is_voided",
      previousValue: true,
      newValue: false,
      message: "Inbound shipment unvoided.",
      userId: input.changedByUserId ?? null,
      userName: input.changedBy,
      employeeNumber: input.employeeNumber ?? null,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------- */
/* LOOKUPS                                                                     */
/* -------------------------------------------------------------------------- */

export async function listInboundShipmentStatusOptions(): Promise<
  InboundShipmentLookupOption[]
> {
  const { rows } = await db.query<InboundShipmentLookupOption>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.inbound_shipment_statuses
    WHERE COALESCE(is_active, true) = true
    ORDER BY sort_order ASC, label ASC
    `
  );

  return rows;
}

export async function listInboundShipmentInvoiceTypeOptions(): Promise<
  InboundShipmentLookupOption[]
> {
  const { rows } = await db.query<InboundShipmentLookupOption>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.inbound_shipment_invoice_types
    WHERE COALESCE(is_active, true) = true
    ORDER BY sort_order ASC, label ASC
    `
  );

  return rows;
}

export async function listInboundShipmentForwarderOptions(): Promise<
  InboundShipmentLookupOption[]
> {
  const { rows } = await db.query<InboundShipmentLookupOption>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.inbound_shipment_forwarders
    WHERE COALESCE(is_active, true) = true
    ORDER BY sort_order ASC, label ASC
    `
  );

  return rows;
}

export async function listInboundShipmentTypeOptions(): Promise<
  InboundShipmentLookupOption[]
> {
  const { rows } = await db.query<InboundShipmentLookupOption>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.inbound_shipment_types
    WHERE COALESCE(is_active, true) = true
    ORDER BY sort_order ASC, label ASC
    `
  );

  return rows;
}

export async function listInboundShipmentCustomerOptions(
  q?: string | null
): Promise<CustomerLookupOption[]> {
  const search = String(q ?? "").trim();
  const params: any[] = [];
  const where: string[] = ["is_active = true"];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
  }

  const prefixParam = params.length + 1;

  const { rows } = await db.query<CustomerLookupOption>(
    `
    SELECT
      id::text AS id,
      code,
      name,
      CONCAT(code, ' - ', name) AS label,
      is_active AS "isActive"
    FROM public.design_workflow_customers
    WHERE ${where.join(" AND ")}
    ORDER BY
      CASE
        WHEN $${prefixParam}::text IS NOT NULL
          AND code ILIKE $${prefixParam}::text || '%'
        THEN 0
        WHEN $${prefixParam}::text IS NOT NULL
          AND name ILIKE $${prefixParam}::text || '%'
        THEN 1
        ELSE 2
      END,
      sort_order ASC,
      name ASC
    LIMIT 50
    `,
    [...params, search || null]
  );

  return rows;
}