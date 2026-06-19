// lib/repositories/quickTurnQuoteSavedListRepo.ts

import { db } from "@/lib/db";

export type SortDir = "asc" | "desc";
export type QuickTurnQuoteStatus = "DRAFT" | "PUBLISHED";

export type QuickTurnSavedQuoteSummaryRow = {
  id: string;
  quoteNumber: string;
  quoteName: string;
  quoteStatus: QuickTurnQuoteStatus;
  workflowSalesOrderNumber: string | null;
  overseasCustomerServiceUserId: string | null;
  overseasCustomerServiceNameSnapshot: string | null;
  overseasCustomerServiceEmailSnapshot: string | null;
  overseasCustomerServiceEmployeeNumberSnapshot: number | null;
  quoteRebateRate: number;
  preparedForCustomerId: string | null;
  preparedForCustomerCodeSnapshot: string | null;
  preparedForCustomerNameSnapshot: string | null;
  quotePreparedForDisplay: string | null;
  programLogoText: string | null;
  fob: string | null;
  sourceQuoteId: string | null;
  sourceQuoteNumber: string | null;
  revisionNumber: number;
  publishedAt: string | null;
  publishedBy: string | null;
  programName: string;
  factoryName: string;
  generatedAt: string;
  validUntil: string;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  itemCount: number;
};

export type QuickTurnQuoteListFilters = {
  q?: string | null;
  quoteNumber?: string | null;
  quoteName?: string | null;
  quoteStatus?: QuickTurnQuoteStatus | "" | null;
  workflowSalesOrderNumber?: string | null;
  revision?: string | null;
  preparedForCustomer?: string | null;
  overseasCustomerService?: string | null;
  programName?: string | null;
  factoryName?: string | null;
  generatedFrom?: string | null;
  generatedTo?: string | null;
  validUntilFrom?: string | null;
  validUntilTo?: string | null;
  itemCount?: string | number | null;
  createdBy?: string | null;
  includeVoided?: boolean;
  onlyVoided?: boolean;
  sortBy?: string | null;
  sortDir?: SortDir | null;
  limit?: number;
  offset?: number;
};

export type PagedQuickTurnQuoteResult = {
  rows: QuickTurnSavedQuoteSummaryRow[];
  total: number;
  pageSize: number;
  offset: number;
};

const QUOTE_SORTS: Record<string, string> = {
  quoteNumber: "qr.quote_number",
  quoteName: "qr.quote_name",
  status: "qr.quote_status",
  quoteStatus: "qr.quote_status",
  workflowSalesOrderNumber: "qr.workflow_sales_order_number",
  revisionNumber: "qr.revision_number",
  preparedForCustomer: "COALESCE(qr.quote_prepared_for_display, qr.prepared_for_customer_name_snapshot, qr.prepared_for_customer_code_snapshot)",
  quotePreparedForDisplay: "qr.quote_prepared_for_display",
  overseasCustomerServiceName: "qr.overseas_customer_service_name_snapshot",
  overseasCustomerService: "qr.overseas_customer_service_name_snapshot",
  programName: "qr.program_name_snapshot",
  factoryName: "qr.factory_name_snapshot",
  generatedAt: "qr.generated_at",
  validUntil: "qr.valid_until",
  itemCount: "qr.item_count",
  createdAt: "qr.created_at",
  createdBy: "qr.created_by",
  updatedAt: "qr.updated_at",
};

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanDate(value: unknown): string | null {
  const s = cleanText(value);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function cleanPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function sortDir(value: SortDir | null | undefined): SortDir {
  return value === "asc" ? "asc" : "desc";
}

function limitOffset(inputLimit?: number, inputOffset?: number) {
  const limit = Number.isFinite(Number(inputLimit))
    ? Math.max(1, Math.min(250, Number(inputLimit)))
    : 25;
  const offset = Number.isFinite(Number(inputOffset)) ? Math.max(0, Number(inputOffset)) : 0;
  return { limit, offset };
}

function addTextFilter(where: string[], params: unknown[], sqlExpression: string, value: unknown) {
  const token = cleanText(value);
  if (!token) return;
  params.push(`%${token}%`);
  where.push(`${sqlExpression} ILIKE $${params.length}`);
}

function addDateFromFilter(where: string[], params: unknown[], sqlExpression: string, value: unknown) {
  const date = cleanDate(value);
  if (!date) return;
  params.push(date);
  where.push(`${sqlExpression}::date >= $${params.length}::date`);
}

function addDateToFilter(where: string[], params: unknown[], sqlExpression: string, value: unknown) {
  const date = cleanDate(value);
  if (!date) return;
  params.push(date);
  where.push(`${sqlExpression}::date <= $${params.length}::date`);
}

function joinWhere(where: string[]) {
  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

function quoteRowsCte() {
  return `
    WITH quote_rows AS (
      SELECT
        q.id,
        q.quote_number,
        q.quote_name,
        q.quote_status,
        q.workflow_sales_order_number,
        q.overseas_customer_service_user_id::text AS overseas_customer_service_user_id,
        q.overseas_customer_service_name_snapshot,
        q.overseas_customer_service_email_snapshot,
        q.overseas_customer_service_employee_number_snapshot,
        q.quote_rebate_rate::float8 AS quote_rebate_rate,
        q.prepared_for_customer_id::text AS prepared_for_customer_id,
        q.prepared_for_customer_code_snapshot,
        q.prepared_for_customer_name_snapshot,
        q.quote_prepared_for_display,
        q.program_logo_text,
        q.fob,
        q.source_quote_id,
        sq.quote_number AS source_quote_number,
        q.revision_number,
        q.published_at,
        q.published_by,
        q.program_name_snapshot,
        q.factory_name_snapshot,
        q.generated_at,
        q.valid_until,
        q.created_at,
        q.created_by,
        q.updated_at,
        q.updated_by,
        COALESCE(q.is_voided, false) AS is_voided,
        q.voided_at,
        q.voided_by,
        q.void_reason,
        COUNT(DISTINCT qi.id)::int AS item_count
      FROM public.quick_turn_quotes q
      LEFT JOIN public.quick_turn_quotes sq ON sq.id = q.source_quote_id
      LEFT JOIN public.quick_turn_quote_items qi ON qi.quote_id = q.id
      GROUP BY q.id, sq.quote_number
    )
  `;
}

function quoteRowsSelect() {
  return `
    qr.id,
    qr.quote_number AS "quoteNumber",
    qr.quote_name AS "quoteName",
    qr.quote_status AS "quoteStatus",
    qr.workflow_sales_order_number AS "workflowSalesOrderNumber",
    qr.overseas_customer_service_user_id AS "overseasCustomerServiceUserId",
    qr.overseas_customer_service_name_snapshot AS "overseasCustomerServiceNameSnapshot",
    qr.overseas_customer_service_email_snapshot AS "overseasCustomerServiceEmailSnapshot",
    qr.overseas_customer_service_employee_number_snapshot AS "overseasCustomerServiceEmployeeNumberSnapshot",
    qr.quote_rebate_rate AS "quoteRebateRate",
    qr.prepared_for_customer_id AS "preparedForCustomerId",
    qr.prepared_for_customer_code_snapshot AS "preparedForCustomerCodeSnapshot",
    qr.prepared_for_customer_name_snapshot AS "preparedForCustomerNameSnapshot",
    qr.quote_prepared_for_display AS "quotePreparedForDisplay",
    qr.program_logo_text AS "programLogoText",
    qr.fob AS fob,
    qr.source_quote_id AS "sourceQuoteId",
    qr.source_quote_number AS "sourceQuoteNumber",
    qr.revision_number AS "revisionNumber",
    qr.published_at AS "publishedAt",
    qr.published_by AS "publishedBy",
    qr.program_name_snapshot AS "programName",
    qr.factory_name_snapshot AS "factoryName",
    qr.generated_at AS "generatedAt",
    qr.valid_until AS "validUntil",
    qr.created_at AS "createdAt",
    qr.created_by AS "createdBy",
    qr.updated_at AS "updatedAt",
    qr.updated_by AS "updatedBy",
    qr.is_voided AS "isVoided",
    qr.voided_at AS "voidedAt",
    qr.voided_by AS "voidedBy",
    qr.void_reason AS "voidReason",
    qr.item_count AS "itemCount"
  `;
}

export async function listSavedQuickTurnQuotes(
  filters: QuickTurnQuoteListFilters = {}
): Promise<PagedQuickTurnQuoteResult> {
  const { limit, offset } = limitOffset(filters.limit, filters.offset);
  const params: unknown[] = [];
  const where: string[] = [];

  if (filters.onlyVoided === true) {
    where.push("qr.is_voided = true");
  } else if (filters.includeVoided !== true) {
    where.push("qr.is_voided = false");
  }

  const status = cleanText(filters.quoteStatus);
  if (status) {
    params.push(status.toUpperCase());
    where.push(`qr.quote_status = $${params.length}`);
  }

  addTextFilter(where, params, "qr.quote_number", filters.quoteNumber);
  addTextFilter(where, params, "qr.quote_name", filters.quoteName);
  addTextFilter(where, params, "qr.workflow_sales_order_number", filters.workflowSalesOrderNumber);
  addTextFilter(
    where,
    params,
    "COALESCE(qr.quote_prepared_for_display, qr.prepared_for_customer_name_snapshot, qr.prepared_for_customer_code_snapshot, '')",
    filters.preparedForCustomer
  );
  addTextFilter(
    where,
    params,
    "COALESCE(qr.overseas_customer_service_name_snapshot, qr.overseas_customer_service_email_snapshot, '')",
    filters.overseasCustomerService
  );
  addTextFilter(where, params, "qr.program_name_snapshot", filters.programName);
  addTextFilter(where, params, "qr.factory_name_snapshot", filters.factoryName);
  addDateFromFilter(where, params, "qr.generated_at", filters.generatedFrom);
  addDateToFilter(where, params, "qr.generated_at", filters.generatedTo);
  addDateFromFilter(where, params, "qr.valid_until", filters.validUntilFrom);
  addDateToFilter(where, params, "qr.valid_until", filters.validUntilTo);
  addTextFilter(where, params, "qr.created_by", filters.createdBy);

  const revision = cleanText(filters.revision);
  if (revision) {
    params.push(`%${revision}%`);
    where.push(`(
      CASE WHEN COALESCE(qr.revision_number, 0) > 0
        THEN 'Rev ' || qr.revision_number::text
        ELSE 'Original'
      END
    ) ILIKE $${params.length}`);
  }

  const itemCount = cleanPositiveInteger(filters.itemCount);
  if (itemCount !== null) {
    params.push(itemCount);
    where.push(`qr.item_count = $${params.length}`);
  }

  const q = cleanText(filters.q);
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    where.push(`(
      qr.quote_number ILIKE $${idx}
      OR qr.quote_name ILIKE $${idx}
      OR qr.workflow_sales_order_number ILIKE $${idx}
      OR qr.overseas_customer_service_name_snapshot ILIKE $${idx}
      OR qr.overseas_customer_service_email_snapshot ILIKE $${idx}
      OR qr.prepared_for_customer_code_snapshot ILIKE $${idx}
      OR qr.prepared_for_customer_name_snapshot ILIKE $${idx}
      OR qr.quote_prepared_for_display ILIKE $${idx}
      OR qr.program_logo_text ILIKE $${idx}
      OR qr.fob ILIKE $${idx}
      OR qr.program_name_snapshot ILIKE $${idx}
      OR qr.factory_name_snapshot ILIKE $${idx}
      OR qr.created_by ILIKE $${idx}
      OR qr.source_quote_number ILIKE $${idx}
      OR (CASE WHEN COALESCE(qr.revision_number, 0) > 0 THEN 'Rev ' || qr.revision_number::text ELSE 'Original' END) ILIKE $${idx}
    )`);
  }

  const whereSql = joinWhere(where);
  const orderBy = QUOTE_SORTS[filters.sortBy || ""] ?? "qr.created_at";
  const dir = sortDir(filters.sortDir);

  const countResult = await db.query<{ total: number }>(
    `
    ${quoteRowsCte()}
    SELECT COUNT(*)::int AS total
    FROM quote_rows qr
    ${whereSql}
    `,
    params
  );

  const dataParams = [...params, limit, offset];
  const { rows } = await db.query<QuickTurnSavedQuoteSummaryRow>(
    `
    ${quoteRowsCte()}
    SELECT ${quoteRowsSelect()}
    FROM quote_rows qr
    ${whereSql}
    ORDER BY ${orderBy} ${dir}, qr.id DESC
    LIMIT $${dataParams.length - 1}
    OFFSET $${dataParams.length}
    `,
    dataParams
  );

  return {
    rows,
    total: countResult.rows[0]?.total ?? 0,
    pageSize: limit,
    offset,
  };
}
