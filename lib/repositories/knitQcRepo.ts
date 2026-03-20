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

/**
 * Data types and repository functions for the Knit QC module.
 *
 * This file closely mirrors the knitProductionRepo.ts implementation but
 * adapts it for the Knit QC module. All functions here follow the
 * shared repository pattern used across the Cap Applications Platform. See
 * knitProductionRepo.ts for reference. Fields and behaviour have been
 * modified to support Knit QC specific requirements such as order,
 * inspected and rejected quantities, reject reasons and per-line QC
 * employee tracking.
 */

export type KnitQcSubmission = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type KnitQcLine = {
  id: string;
  submissionId: string;
  entryTs: string;
  entryDate: string;
  shiftDate: string | null;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  detailNumber: number;
  logo: string | null;
  orderQuantity: number;
  inspectedQuantity: number;
  rejectedQuantity: number | null;
  rejectReasonId: string | null;
  qcEmployeeNumber: number | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type KnitQcLineInput = {
  detailNumber: number;
  logo: string | null;
  orderQuantity: number;
  inspectedQuantity: number;
  rejectedQuantity: number | null;
  rejectReasonId: string | null;
  qcEmployeeNumber: number | null;
  notes: string | null;
};

export type CreateKnitQcSubmissionInput = {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  stockOrder: boolean;
  salesOrderDisplay: string | null;
  notes: string | null;
  lines: KnitQcLineInput[];
};

export type ReplaceKnitQcSubmissionInput = {
  id: string;
  entryTs: Date;
  stockOrder: boolean;
  salesOrderDisplay: string | null;
  notes: string | null;
  lines: KnitQcLineInput[];
};

export type KnitQcSubmissionSummaryRow = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  lineCount: number;
  totalInspected: number;
  totalRejected: number;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type ListKnitQcSubmissionSummariesRangeArgs = StandardRepoOptions & {
  entryDateFrom: string;
  entryDateTo: string;
  employeeNumber?: number;
  name?: string;
  salesOrderStartsWith?: string;
  notes?: string;
  stockOrder?: boolean | null;
  sortBy?:
    | "entryDate"
    | "entryTs"
    | "name"
    | "shift"
    | "stockOrder"
    | "salesOrder"
    | "lineCount"
    | "totalInspected"
    | "totalRejected"
    | "isVoided";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

function chicagoParts(d: Date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = dtf.formatToParts(d);
  const get = (type: string, fallback: string) =>
    parts.find((p) => p.type === type)?.value ?? fallback;

  return {
    year: get("year", "1970"),
    month: get("month", "01"),
    day: get("day", "01"),
    hour: Number(get("hour", "0")),
    minute: Number(get("minute", "0")),
    second: Number(get("second", "0")),
  };
}

function ymdChicago(d: Date): string {
  const p = chicagoParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);

  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function deriveShiftInfo(entryTs: Date): { shift: string; shiftDate: string } {
  const p = chicagoParts(entryTs);
  const entryDate = `${p.year}-${p.month}-${p.day}`;

  if (p.hour >= 6 && p.hour < 18) {
    return {
      shift: "Day",
      shiftDate: entryDate,
    };
  }

  return {
    shift: "Night",
    shiftDate: p.hour < 6 ? addDaysToYmd(entryDate, -1) : entryDate,
  };
}

/**
 * Sales order is now allowed even when stockOrder is true.
 * We still derive the base when a value is present.
 */
function normalizeSalesOrder(
  salesOrderDisplay: string | null,
  _stockOrder: boolean
): {
  salesOrderDisplay: string | null;
  salesOrderBase: string | null;
} {
  const display = String(salesOrderDisplay ?? "").trim();
  if (!display) {
    return {
      salesOrderDisplay: null,
      salesOrderBase: null,
    };
  }

  const m = display.match(/^(\d{7})/);
  return {
    salesOrderDisplay: display,
    salesOrderBase: m ? m[1] : null,
  };
}

function submissionSelectSql() {
  return `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.entry_date AS "entryDate",
      s.name,
      s.employee_number AS "employeeNumber",
      s.shift,
      s.stock_order AS "stockOrder",
      COALESCE(s.sales_order_display, s.sales_order_base) AS "salesOrder",
      s.sales_order_base AS "salesOrderBase",
      s.sales_order_display AS "salesOrderDisplay",
      s.notes,
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt"
    FROM public.knit_qc_submissions s
  `;
}

function lineSelectSql() {
  return `
    SELECT
      l.id,
      l.submission_id AS "submissionId",
      l.entry_ts AS "entryTs",
      l.entry_date AS "entryDate",
      l.shift_date AS "shiftDate",
      l.name,
      l.employee_number AS "employeeNumber",
      l.shift,
      l.stock_order AS "stockOrder",
      COALESCE(l.sales_order_display, l.sales_order_base) AS "salesOrder",
      l.sales_order_base AS "salesOrderBase",
      l.sales_order_display AS "salesOrderDisplay",
      l.detail_number AS "detailNumber",
      l.logo,
      l.order_quantity AS "orderQuantity",
      l.inspected_quantity AS "inspectedQuantity",
      l.rejected_quantity AS "rejectedQuantity",
      l.reject_reason_id AS "rejectReasonId",
      l.qc_employee_number AS "qcEmployeeNumber",
      l.line_notes AS "notes",
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt"
    FROM public.knit_qc_submission_lines l
  `;
}

function resolveOrderBy(
  sortBy: ListKnitQcSubmissionSummariesRangeArgs["sortBy"],
  sortDir: ListKnitQcSubmissionSummariesRangeArgs["sortDir"]
) {
  const allowed: Record<
    NonNullable<ListKnitQcSubmissionSummariesRangeArgs["sortBy"]>,
    string
  > = {
    entryDate: `s.entry_date`,
    entryTs: `s.entry_ts`,
    name: `s.name`,
    shift: `s.shift`,
    stockOrder: `s.stock_order`,
    salesOrder: `COALESCE(s.sales_order_display, s.sales_order_base)`,
    lineCount: `"lineCount"`,
    totalInspected: `"totalInspected"`,
    totalRejected: `"totalRejected"`,
    isVoided: `COALESCE(s.is_voided, false)`,
  };

  const base = allowed[sortBy ?? "entryTs"] ?? allowed.entryTs;
  const dir = String(sortDir ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  return `${base} ${dir}, s.entry_ts DESC, s.id DESC`;
}

function buildWhere(args: ListKnitQcSubmissionSummariesRangeArgs) {
  const params: any[] = [];
  const where: string[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(args)));

  params.push(args.entryDateFrom);
  pushWhere(where, `s.entry_date >= $${params.length}::date`);

  params.push(args.entryDateTo);
  pushWhere(where, `s.entry_date <= $${params.length}::date`);

  if (args.employeeNumber != null) {
    params.push(args.employeeNumber);
    pushWhere(where, `s.employee_number = $${params.length}`);
  }

  if (args.name?.trim()) {
    params.push(`%${args.name.trim()}%`);
    pushWhere(where, `s.name ILIKE $${params.length}`);
  }

  if (args.salesOrderStartsWith?.trim()) {
    params.push(`${args.salesOrderStartsWith.trim()}%`);
    pushWhere(
      where,
      `COALESCE(s.sales_order_display, s.sales_order_base, '') ILIKE $${params.length}`
    );
  }

  if (args.notes?.trim()) {
    params.push(`%${args.notes.trim()}%`);
    pushWhere(where, `COALESCE(s.notes, '') ILIKE $${params.length}`);
  }

  if (args.stockOrder === true) {
    pushWhere(where, `s.stock_order = true`);
  } else if (args.stockOrder === false) {
    pushWhere(where, `s.stock_order = false`);
  }

  return {
    whereSql: joinWhere(where),
    params,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function normalizeOptionalInt(value: number | null | undefined): number | null {
  return Number.isInteger(value) ? Number(value) : null;
}

async function insertKnitQcLines(
  queryable: Queryable,
  input: {
    submissionId: string;
    entryTs: Date;
    entryDate: string;
    shiftDate: string;
    shift: string;
    name: string;
    employeeNumber: number;
    stockOrder: boolean;
    salesOrderBase: string | null;
    salesOrderDisplay: string | null;
    lines: KnitQcLineInput[];
  }
) {
  for (const line of input.lines) {
    await queryable.query(
      `
      INSERT INTO public.knit_qc_submission_lines (
        submission_id,
        entry_ts,
        entry_date,
        shift_date,
        name,
        employee_number,
        shift,
        stock_order,
        sales_order_base,
        sales_order_display,
        detail_number,
        logo,
        order_quantity,
        inspected_quantity,
        rejected_quantity,
        reject_reason_id,
        qc_employee_number,
        line_notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      `,
      [
        input.submissionId,
        input.entryTs,
        input.entryDate,
        input.shiftDate,
        input.name,
        input.employeeNumber,
        input.shift,
        input.stockOrder,
        input.salesOrderBase,
        input.salesOrderDisplay,
        line.detailNumber,
        normalizeOptionalText(line.logo),
        line.orderQuantity,
        line.inspectedQuantity,
        normalizeOptionalInt(line.rejectedQuantity),
        normalizeOptionalText(line.rejectReasonId),
        normalizeOptionalInt(line.qcEmployeeNumber),
        normalizeOptionalText(line.notes),
      ]
    );
  }
}

export async function createKnitQcSubmission(
  input: CreateKnitQcSubmissionInput
): Promise<{ id: string }> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const entryDate = ymdChicago(input.entryTs);
    const shiftInfo = deriveShiftInfo(input.entryTs);
    const so = normalizeSalesOrder(input.salesOrderDisplay, input.stockOrder);

    const submissionInsert = await client.query<{ id: string }>(
      `
      INSERT INTO public.knit_qc_submissions (
        entry_ts,
        entry_date,
        name,
        employee_number,
        shift,
        stock_order,
        sales_order_base,
        sales_order_display,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
      `,
      [
        input.entryTs,
        entryDate,
        input.name,
        input.employeeNumber,
        shiftInfo.shift,
        input.stockOrder,
        so.salesOrderBase,
        so.salesOrderDisplay,
        normalizeOptionalText(input.notes),
      ]
    );

    const submissionId = submissionInsert.rows[0]!.id;

    await insertKnitQcLines(client, {
      submissionId,
      entryTs: input.entryTs,
      entryDate,
      shiftDate: shiftInfo.shiftDate,
      shift: shiftInfo.shift,
      name: input.name,
      employeeNumber: input.employeeNumber,
      stockOrder: input.stockOrder,
      salesOrderBase: so.salesOrderBase,
      salesOrderDisplay: so.salesOrderDisplay,
      lines: input.lines,
    });

    await client.query("COMMIT");
    return { id: submissionId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getKnitQcSubmissionById(
  id: string,
  options?: StandardRepoOptions
): Promise<KnitQcSubmission | null> {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(options)));
  params.push(id);
  pushWhere(where, `s.id = $${params.length}`);

  const { rows } = await db.query<KnitQcSubmission>(
    `
    ${submissionSelectSql()}
    ${joinWhere(where)}
    LIMIT 1
    `,
    params
  );

  return rows[0] ?? null;
}

export async function listKnitQcLinesBySubmissionId(
  submissionId: string
): Promise<KnitQcLine[]> {
  const { rows } = await db.query<KnitQcLine>(
    `
    ${lineSelectSql()}
    WHERE l.submission_id = $1
    ORDER BY l.detail_number ASC NULLS LAST, l.created_at ASC, l.id ASC
    `,
    [submissionId]
  );
  return rows;
}

export async function replaceKnitQcSubmission(
  input: ReplaceKnitQcSubmissionInput
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{
      id: string;
      name: string;
      employee_number: number;
      is_voided: boolean;
    }>(
      `
      SELECT id, name, employee_number, COALESCE(is_voided, false) AS is_voided
      FROM public.knit_qc_submissions
      WHERE id = $1
      LIMIT 1
      `,
      [input.id]
    );

    const current = existing.rows[0];
    if (!current) {
      throw new Error("Submission not found.");
    }
    if (current.is_voided) {
      throw new Error("Voided submissions cannot be edited.");
    }

    const entryDate = ymdChicago(input.entryTs);
    const shiftInfo = deriveShiftInfo(input.entryTs);
    const so = normalizeSalesOrder(input.salesOrderDisplay, input.stockOrder);

    await client.query(
      `
      UPDATE public.knit_qc_submissions
      SET
        entry_ts = $2,
        entry_date = $3,
        shift = $4,
        stock_order = $5,
        sales_order_base = $6,
        sales_order_display = $7,
        notes = $8,
        updated_at = NOW()
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      `,
      [
        input.id,
        input.entryTs,
        entryDate,
        shiftInfo.shift,
        input.stockOrder,
        so.salesOrderBase,
        so.salesOrderDisplay,
        normalizeOptionalText(input.notes),
      ]
    );

    await client.query(
      `DELETE FROM public.knit_qc_submission_lines WHERE submission_id = $1`,
      [input.id]
    );

    await insertKnitQcLines(client, {
      submissionId: input.id,
      entryTs: input.entryTs,
      entryDate,
      shiftDate: shiftInfo.shiftDate,
      shift: shiftInfo.shift,
      name: current.name,
      employeeNumber: current.employee_number,
      stockOrder: input.stockOrder,
      salesOrderBase: so.salesOrderBase,
      salesOrderDisplay: so.salesOrderDisplay,
      lines: input.lines,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listKnitQcSubmissionsBySalesOrder(
  salesOrder: string,
  employeeNumber?: number,
  options?: StandardRepoOptions
): Promise<
  Array<{
    id: string;
    entryTs: string;
    salesOrder: string | null;
    notes: string | null;
    lineCount: number;
    isVoided: boolean;
  }>
> {
  const params: any[] = [];
  const where: string[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(options)));

  const so = String(salesOrder ?? "").trim();
  if (so) {
    params.push(`${so}%`);
    pushWhere(
      where,
      `COALESCE(s.sales_order_display, s.sales_order_base, '') ILIKE $${params.length}`
    );
  }

  if (employeeNumber != null) {
    params.push(employeeNumber);
    pushWhere(where, `s.employee_number = $${params.length}`);
  }

  const whereSql = joinWhere(where);

  const { rows } = await db.query(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      COALESCE(s.sales_order_display, s.sales_order_base) AS "salesOrder",
      s.notes,
      COUNT(l.id)::int AS "lineCount",
      COALESCE(s.is_voided, false) AS "isVoided"
    FROM public.knit_qc_submissions s
    LEFT JOIN public.knit_qc_submission_lines l
      ON l.submission_id = s.id
    ${whereSql}
    GROUP BY s.id, s.entry_ts, s.sales_order_display, s.sales_order_base, s.notes, s.is_voided
    ORDER BY s.entry_ts DESC
    LIMIT 50
    `,
    params
  );

  return rows;
}

export async function listKnitQcSubmissionSummariesRange(
  args: ListKnitQcSubmissionSummariesRangeArgs
): Promise<{ rows: KnitQcSubmissionSummaryRow[]; totalCount: number }> {
  const { whereSql, params } = buildWhere(args);
  const orderSql = resolveOrderBy(args.sortBy, args.sortDir);
  const limit = Math.max(1, Math.min(200, args.limit ?? 25));
  const offset = Math.max(0, args.offset ?? 0);

  const countSql = `
    SELECT COUNT(*)::int AS "totalCount"
    FROM public.knit_qc_submissions s
    ${whereSql}
  `;
  const countResult = await db.query<{ totalCount: number }>(countSql, params);
  const totalCount = countResult.rows[0]?.totalCount ?? 0;

  const listParams = [...params, limit, offset];
  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;

  const { rows } = await db.query<KnitQcSubmissionSummaryRow>(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.entry_date AS "entryDate",
      s.name,
      s.employee_number AS "employeeNumber",
      s.shift,
      s.stock_order AS "stockOrder",
      COALESCE(s.sales_order_display, s.sales_order_base) AS "salesOrder",
      s.sales_order_base AS "salesOrderBase",
      s.sales_order_display AS "salesOrderDisplay",
      COUNT(l.id)::int AS "lineCount",
      COALESCE(SUM(l.inspected_quantity), 0)::int AS "totalInspected",
      COALESCE(SUM(l.rejected_quantity), 0)::int AS "totalRejected",
      s.notes,
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason"
    FROM public.knit_qc_submissions s
    LEFT JOIN public.knit_qc_submission_lines l
      ON l.submission_id = s.id
    ${whereSql}
    GROUP BY
      s.id,
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,
      s.shift,
      s.stock_order,
      s.sales_order_display,
      s.sales_order_base,
      s.notes,
      s.is_voided,
      s.voided_at,
      s.voided_by,
      s.void_reason
    ORDER BY ${orderSql}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `,
    listParams
  );

  return { rows, totalCount };
}

export async function canUserEditOwnKnitQcSubmission(input: {
  id: string;
  employeeNumber: number;
}): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.knit_qc_submissions
      WHERE id = $1
        AND employee_number = $2
        AND COALESCE(is_voided, false) = false
    ) AS ok
    `,
    [input.id, input.employeeNumber]
  );

  return !!rows[0]?.ok;
}

export async function voidKnitQcSubmission(input: {
  id: string;
  voidedBy: string;
  reason?: string | null;
}): Promise<boolean> {
  const { rowCount } = await db.query(
    `
    UPDATE public.knit_qc_submissions
    SET
      is_voided = true,
      voided_at = NOW(),
      voided_by = $2,
      void_reason = $3,
      updated_at = NOW()
    WHERE id = $1
      AND COALESCE(is_voided, false) = false
    `,
    [input.id, input.voidedBy, input.reason ?? null]
  );

  return (rowCount ?? 0) > 0;
}