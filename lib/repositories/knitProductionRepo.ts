import { db } from "@/lib/db";
import { buildVoidedWhereClause, joinWhere, pushWhere } from "@/lib/repositories/_shared/repoFilters";
import { resolveVoidMode, type StandardRepoOptions } from "@/lib/repositories/_shared/repoTypes";

export type KnitAreaLookupRow = {
  id: string;
  areaName: string;
  sortOrder: number;
  isActive: boolean;
};

export type KnitProductionSubmission = {
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
  knitArea: string;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type KnitProductionLine = {
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
  knitArea: string;
  detailNumber: number | null;
  itemStyle: string | null;
  logo: string | null;
  quantity: number | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type KnitProductionLineInput = {
  detailNumber: number;
  itemStyle: string;
  logo: string;
  quantity: number;
  notes: string | null;
};

export type CreateKnitProductionSubmissionInput = {
  entryTs: Date;
  name: string;
  employeeNumber: number;
  stockOrder: boolean;
  salesOrderDisplay: string | null;
  knitArea: string;
  notes: string | null;
  lines: KnitProductionLineInput[];
};

export type ReplaceKnitProductionSubmissionInput = {
  id: string;
  entryTs: Date;
  stockOrder: boolean;
  salesOrderDisplay: string | null;
  knitArea: string;
  notes: string | null;
  lines: KnitProductionLineInput[];
};

export type KnitSubmissionSummaryRow = {
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
  knitArea: string;
  lineCount: number;
  totalQuantity: number;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type ListKnitSubmissionSummariesRangeArgs = StandardRepoOptions & {
  entryDateFrom: string;
  entryDateTo: string;
  employeeNumber?: number;
  name?: string;
  salesOrderStartsWith?: string;
  itemStyle?: string;
  logo?: string;
  notes?: string;
  knitArea?: string;
  stockOrder?: boolean | null;
  sortBy?:
    | "entryDate"
    | "entryTs"
    | "name"
    | "shift"
    | "stockOrder"
    | "salesOrder"
    | "knitArea"
    | "lineCount"
    | "totalQuantity"
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

function normalizeSalesOrder(
  salesOrderDisplay: string | null,
  stockOrder: boolean
): {
  salesOrderDisplay: string | null;
  salesOrderBase: string | null;
} {
  if (stockOrder) {
    return {
      salesOrderDisplay: null,
      salesOrderBase: null,
    };
  }

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

function normalizeKnitArea(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export async function listActiveKnitAreaLookup(): Promise<KnitAreaLookupRow[]> {
  const { rows } = await db.query<KnitAreaLookupRow>(
    `
    SELECT
      id,
      area_name AS "areaName",
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.knit_area_lookup
    WHERE is_active = true
    ORDER BY sort_order ASC, area_name ASC
    `
  );

  return rows;
}

export async function knitAreaExists(areaName: string): Promise<boolean> {
  const value = normalizeKnitArea(areaName);
  if (!value) return false;

  const { rows } = await db.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.knit_area_lookup
      WHERE area_name = $1
        AND is_active = true
    ) AS ok
    `,
    [value]
  );

  return !!rows[0]?.ok;
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
      s.knit_area AS "knitArea",
      s.notes,
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt"
    FROM public.knit_production_submissions s
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
      l.knit_area AS "knitArea",
      l.detail_number AS "detailNumber",
      l.item_style AS "itemStyle",
      l.logo,
      l.quantity,
      l.line_notes AS "notes",
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt"
    FROM public.knit_production_lines l
  `;
}

function resolveOrderBy(
  sortBy: ListKnitSubmissionSummariesRangeArgs["sortBy"],
  sortDir: ListKnitSubmissionSummariesRangeArgs["sortDir"]
) {
  const allowedSort: Record<NonNullable<ListKnitSubmissionSummariesRangeArgs["sortBy"]>, string> = {
    entryDate: `s.entry_date`,
    entryTs: `s.entry_ts`,
    name: `s.name`,
    shift: `s.shift`,
    stockOrder: `s.stock_order`,
    salesOrder: `COALESCE(s.sales_order_display, s.sales_order_base)`,
    knitArea: `s.knit_area`,
    lineCount: `"lineCount"`,
    totalQuantity: `"totalQuantity"`,
    isVoided: `COALESCE(s.is_voided, false)`,
  };

  const base = allowedSort[sortBy ?? "entryTs"] ?? allowedSort.entryTs;
  const dir = String(sortDir ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  return `${base} ${dir}, s.entry_ts DESC, s.id DESC`;
}

function buildWhere(args: ListKnitSubmissionSummariesRangeArgs) {
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
    pushWhere(where, `COALESCE(s.sales_order_display, s.sales_order_base, '') ILIKE $${params.length}`);
  }

  if (args.notes?.trim()) {
    params.push(`%${args.notes.trim()}%`);
    pushWhere(where, `COALESCE(s.notes, '') ILIKE $${params.length}`);
  }

  if (args.knitArea?.trim()) {
    params.push(`%${args.knitArea.trim()}%`);
    pushWhere(where, `COALESCE(s.knit_area, '') ILIKE $${params.length}`);
  }

  if (args.itemStyle?.trim()) {
    params.push(`%${args.itemStyle.trim()}%`);
    pushWhere(
      where,
      `
      EXISTS (
        SELECT 1
        FROM public.knit_production_lines lx
        WHERE lx.submission_id = s.id
          AND COALESCE(lx.item_style, '') ILIKE $${params.length}
      )
      `
    );
  }

  if (args.logo?.trim()) {
    params.push(`%${args.logo.trim()}%`);
    pushWhere(
      where,
      `
      EXISTS (
        SELECT 1
        FROM public.knit_production_lines lx
        WHERE lx.submission_id = s.id
          AND COALESCE(lx.logo, '') ILIKE $${params.length}
      )
      `
    );
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

async function insertKnitLines(
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
    knitArea: string;
    lines: KnitProductionLineInput[];
  }
) {
  for (const line of input.lines) {
    await queryable.query(
      `
      INSERT INTO public.knit_production_lines (
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
        knit_area,
        detail_number,
        item_style,
        logo,
        quantity,
        line_notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
        input.knitArea,
        line.detailNumber,
        line.itemStyle,
        line.logo,
        line.quantity,
        line.notes,
      ]
    );
  }
}

export async function createKnitProductionSubmission(
  input: CreateKnitProductionSubmissionInput
): Promise<{ id: string }> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const entryDate = ymdChicago(input.entryTs);
    const shiftInfo = deriveShiftInfo(input.entryTs);
    const so = normalizeSalesOrder(input.salesOrderDisplay, input.stockOrder);

    const submissionInsert = await client.query<{ id: string }>(
      `
      INSERT INTO public.knit_production_submissions (
        entry_ts,
        entry_date,
        name,
        employee_number,
        shift,
        stock_order,
        sales_order_base,
        sales_order_display,
        knit_area,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
        input.knitArea,
        input.notes,
      ]
    );

    const submissionId = submissionInsert.rows[0]!.id;

    await insertKnitLines(client, {
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
      knitArea: input.knitArea,
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

export async function getKnitProductionSubmissionById(
  id: string,
  options?: StandardRepoOptions
): Promise<KnitProductionSubmission | null> {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(options)));
  params.push(id);
  pushWhere(where, `s.id = $${params.length}`);

  const { rows } = await db.query<KnitProductionSubmission>(
    `
    ${submissionSelectSql()}
    ${joinWhere(where)}
    LIMIT 1
    `,
    params
  );

  return rows[0] ?? null;
}

export async function listKnitProductionLinesBySubmissionId(
  submissionId: string
): Promise<KnitProductionLine[]> {
  const { rows } = await db.query<KnitProductionLine>(
    `
    ${lineSelectSql()}
    WHERE l.submission_id = $1
    ORDER BY l.detail_number ASC NULLS LAST, l.created_at ASC, l.id ASC
    `,
    [submissionId]
  );

  return rows;
}

export async function replaceKnitProductionSubmission(
  input: ReplaceKnitProductionSubmissionInput
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
      SELECT
        id,
        name,
        employee_number,
        COALESCE(is_voided, false) AS is_voided
      FROM public.knit_production_submissions
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
      UPDATE public.knit_production_submissions
      SET
        entry_ts = $2,
        entry_date = $3,
        shift = $4,
        stock_order = $5,
        sales_order_base = $6,
        sales_order_display = $7,
        knit_area = $8,
        notes = $9,
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
        input.knitArea,
        input.notes,
      ]
    );

    await client.query(
      `DELETE FROM public.knit_production_lines WHERE submission_id = $1`,
      [input.id]
    );

    await insertKnitLines(client, {
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
      knitArea: input.knitArea,
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

export async function listKnitProductionSubmissionsBySalesOrder(
  salesOrder: string,
  employeeNumber?: number,
  options?: StandardRepoOptions
): Promise<
  Array<{
    id: string;
    entryTs: string;
    salesOrder: string | null;
    knitArea: string;
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
    pushWhere(where, `COALESCE(s.sales_order_display, s.sales_order_base, '') ILIKE $${params.length}`);
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
      s.knit_area AS "knitArea",
      s.notes,
      COUNT(l.id)::int AS "lineCount",
      COALESCE(s.is_voided, false) AS "isVoided"
    FROM public.knit_production_submissions s
    LEFT JOIN public.knit_production_lines l
      ON l.submission_id = s.id
    ${whereSql}
    GROUP BY
      s.id,
      s.entry_ts,
      s.sales_order_display,
      s.sales_order_base,
      s.knit_area,
      s.notes,
      s.is_voided
    ORDER BY s.entry_ts DESC
    LIMIT 50
    `,
    params
  );

  return rows;
}

export async function listKnitSubmissionSummariesRange(
  args: ListKnitSubmissionSummariesRangeArgs
): Promise<{ rows: KnitSubmissionSummaryRow[]; totalCount: number }> {
  const { whereSql, params } = buildWhere(args);
  const orderSql = resolveOrderBy(args.sortBy, args.sortDir);

  const limit = Math.max(1, Math.min(200, args.limit ?? 25));
  const offset = Math.max(0, args.offset ?? 0);

  const countSql = `
    SELECT COUNT(*)::int AS "totalCount"
    FROM public.knit_production_submissions s
    ${whereSql}
  `;

  const countResult = await db.query<{ totalCount: number }>(countSql, params);
  const totalCount = countResult.rows[0]?.totalCount ?? 0;

  const listParams = [...params, limit, offset];
  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;

  const { rows } = await db.query<KnitSubmissionSummaryRow>(
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
      s.knit_area AS "knitArea",
      COUNT(l.id)::int AS "lineCount",
      COALESCE(SUM(l.quantity), 0)::int AS "totalQuantity",
      s.notes,
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason"
    FROM public.knit_production_submissions s
    LEFT JOIN public.knit_production_lines l
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
      s.knit_area,
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

export async function canUserEditOwnKnitSubmission(input: {
  id: string;
  employeeNumber: number;
}): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.knit_production_submissions
      WHERE id = $1
        AND employee_number = $2
        AND COALESCE(is_voided, false) = false
    ) AS ok
    `,
    [input.id, input.employeeNumber]
  );

  return !!rows[0]?.ok;
}

export async function voidKnitProductionSubmission(input: {
  id: string;
  voidedBy: string;
  reason?: string | null;
}): Promise<boolean> {
  const { rowCount } = await db.query(
    `
    UPDATE public.knit_production_submissions
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