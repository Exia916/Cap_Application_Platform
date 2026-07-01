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
import type {
  InboundShipmentSummaryRow,
  SortDir,
} from "@/lib/repositories/inboundShipmentRepo";

export type InboundShipmentListPageFilters = StandardRepoOptions & {
  q?: string | null;
  statusId?: number | string | null;
  status?: string | null;
  excludeStatusCodes?: string[] | string | null;

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

export type PagedInboundShipmentListResult = {
  rows: InboundShipmentSummaryRow[];
  total: number;
  pageSize: number;
  offset: number;
};

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

function normalizeStatusCodeList(value: string[] | string | null | undefined): string[] {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",")
        .map((x) => x.trim());

  return raw
    .flatMap((x) => String(x ?? "").split(","))
    .map((x) =>
      String(x || "")
        .trim()
        .replace(/[-\s]+/g, "_")
        .toUpperCase()
    )
    .filter(Boolean);
}

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

function addExcludedStatusCodeFilter(
  where: string[],
  params: any[],
  excludeStatusCodes?: string[] | string | null
) {
  const codes = normalizeStatusCodeList(excludeStatusCodes);
  if (!codes.length) return;

  params.push(codes);
  pushWhere(where, `NOT (UPPER(st.code) = ANY($${params.length}::text[]))`);
}

function shipmentCostSelectSql() {
  return `
      s.estimated_cost_per_piece::float AS "estimatedCostPerPiece",
      s.estimated_cost_per_dozen::float AS "estimatedCostPerDozen",
      cost_totals.total_cost::float AS "totalCost",
      quantity_totals.total_quantity::int AS "totalQuantity",
      CASE
        WHEN quantity_totals.total_quantity > 0
          THEN ROUND((cost_totals.total_cost / quantity_totals.total_quantity)::numeric, 4)::float
        ELSE NULL
      END AS "actualCostPerPiece",
      CASE
        WHEN quantity_totals.total_quantity > 0
          THEN ROUND(((cost_totals.total_cost / quantity_totals.total_quantity) * 12)::numeric, 4)::float
        ELSE NULL
      END AS "actualCostPerDozen"
  `;
}

function shipmentCostJoinsSql() {
  return `
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(ix.amount, 0)), 0)::numeric AS total_cost
      FROM public.inbound_shipment_invoices ix
      WHERE ix.inbound_shipment_id = s.id
    ) cost_totals ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(lx.quantity, 0)), 0)::numeric AS total_quantity
      FROM public.inbound_shipment_lines lx
      WHERE lx.inbound_shipment_id = s.id
    ) quantity_totals ON true
  `;
}

function buildWhere(filters: InboundShipmentListPageFilters) {
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
  addExcludedStatusCodeFilter(where, params, filters.excludeStatusCodes);

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
    estimatedCostPerPiece: `s.estimated_cost_per_piece ${dir} NULLS LAST`,
    estimatedCostPerDozen: `s.estimated_cost_per_dozen ${dir} NULLS LAST`,
    totalCost: `cost_totals.total_cost ${dir} NULLS LAST`,
    totalQuantity: `quantity_totals.total_quantity ${dir} NULLS LAST`,
    actualCostPerPiece: `
      CASE
        WHEN quantity_totals.total_quantity > 0
          THEN cost_totals.total_cost / quantity_totals.total_quantity
        ELSE NULL
      END ${dir} NULLS LAST`,
    actualCostPerDozen: `
      CASE
        WHEN quantity_totals.total_quantity > 0
          THEN (cost_totals.total_cost / quantity_totals.total_quantity) * 12
        ELSE NULL
      END ${dir} NULLS LAST`,
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

export async function listInboundShipmentsForList(
  filters: InboundShipmentListPageFilters
): Promise<PagedInboundShipmentListResult> {
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
      ${shipmentCostSelectSql()},
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
    ${shipmentCostJoinsSql()}
    LEFT JOIN public.inbound_shipment_lines l
      ON l.inbound_shipment_id = s.id
    LEFT JOIN public.inbound_shipment_invoices i
      ON i.inbound_shipment_id = s.id
    ${whereSql}
    GROUP BY s.id, st.id, fw.id, typ.id, cost_totals.total_cost, quantity_totals.total_quantity
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