import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManagerOrAdmin } from "../_shared/adminAuth";

export const runtime = "nodejs";

type SortKey =
  | "entry_date"
  | "entry_ts"
  | "name"
  | "employee_number"
  | "shift"
  | "stock_order"
  | "sales_order"
  | "line_count"
  | "total_inspected"
  | "total_rejected"
  | "is_voided";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function escCsvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isYmd(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function defaultDateRange() {
  const to = ymdChicago(new Date());
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 29);
  const from = ymdChicago(fromDate);

  return { from, to };
}

export async function GET(req: NextRequest) {
  const auth = await requireManagerOrAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const defaults = defaultDateRange();

  const entryDateFrom = isYmd(searchParams.get("entryDateFrom"))
    ? String(searchParams.get("entryDateFrom"))
    : defaults.from;

  const entryDateTo = isYmd(searchParams.get("entryDateTo"))
    ? String(searchParams.get("entryDateTo"))
    : defaults.to;

  const name = (searchParams.get("name") || "").trim();
  const employeeNumberRaw = (searchParams.get("employeeNumber") || "").trim();
  const salesOrder = (searchParams.get("salesOrder") || "").trim();
  const notes = (searchParams.get("notes") || "").trim();

  const stockOrderRaw = (searchParams.get("stockOrder") || "").trim().toLowerCase();
  const stockOrder =
    stockOrderRaw === "true" ? true : stockOrderRaw === "false" ? false : null;

  const includeVoided = searchParams.get("includeVoided") === "true";
  const onlyVoided = searchParams.get("onlyVoided") === "true";

  const page = Math.max(1, toInt(searchParams.get("page"), 1));
  const pageSize = clamp(toInt(searchParams.get("pageSize"), 25), 1, 500);
  const offset = (page - 1) * pageSize;

  const sort = (searchParams.get("sort") || "entry_ts") as SortKey;
  const dir = (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const format = (searchParams.get("format") || "").toLowerCase();

  const where: string[] = [];
  const params: any[] = [];

  params.push(entryDateFrom);
  where.push(`s.entry_date >= $${params.length}::date`);

  params.push(entryDateTo);
  where.push(`s.entry_date <= $${params.length}::date`);

  if (name) {
    params.push(`%${name}%`);
    where.push(`s.name ILIKE $${params.length}`);
  }

  if (employeeNumberRaw) {
    params.push(`${employeeNumberRaw}%`);
    where.push(`COALESCE(s.employee_number::text, '') LIKE $${params.length}`);
  }

  if (salesOrder) {
    params.push(`${salesOrder}%`);
    where.push(
      `(COALESCE(s.sales_order_display, '') ILIKE $${params.length} OR COALESCE(s.sales_order_base, '') ILIKE $${params.length})`
    );
  }

  if (notes) {
    params.push(`%${notes}%`);
    where.push(`COALESCE(s.notes, '') ILIKE $${params.length}`);
  }

  if (stockOrder !== null) {
    params.push(stockOrder);
    where.push(`s.stock_order = $${params.length}`);
  }

  if (onlyVoided) {
    where.push(`COALESCE(s.is_voided, false) = true`);
  } else if (!includeVoided) {
    where.push(`COALESCE(s.is_voided, false) = false`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const ORDER_MAP: Record<SortKey, string> = {
    entry_date: "s.entry_date",
    entry_ts: "s.entry_ts",
    name: "s.name",
    employee_number: "s.employee_number",
    shift: "s.shift",
    stock_order: "s.stock_order",
    sales_order: "COALESCE(s.sales_order_display, s.sales_order_base)",
    line_count: "COALESCE(agg.line_count, 0)",
    total_inspected: "COALESCE(agg.total_inspected, 0)",
    total_rejected: "COALESCE(agg.total_rejected, 0)",
    is_voided: "COALESCE(s.is_voided, false)",
  };

  const orderExpr = ORDER_MAP[sort] ?? ORDER_MAP.entry_ts;
  const orderBySql = `${orderExpr} ${dir}, s.id DESC`;

  const baseFrom = `
    FROM public.knit_qc_submissions s
    LEFT JOIN (
      SELECT
        l.submission_id,
        COUNT(*)::int AS line_count,
        COALESCE(SUM(l.inspected_quantity), 0)::int AS total_inspected,
        COALESCE(SUM(l.rejected_quantity), 0)::int AS total_rejected
      FROM public.knit_qc_submission_lines l
      GROUP BY l.submission_id
    ) agg
      ON agg.submission_id = s.id
    ${whereSql}
  `;

  const totalsRes = await db.query<{
    total_inspected: number;
    total_rejected: number;
    total_lines: number;
    total_rows: number;
  }>(
    `
    SELECT
      COALESCE(SUM(COALESCE(agg.total_inspected, 0)), 0)::int AS total_inspected,
      COALESCE(SUM(COALESCE(agg.total_rejected, 0)), 0)::int AS total_rejected,
      COALESCE(SUM(COALESCE(agg.line_count, 0)), 0)::int AS total_lines,
      COUNT(*)::int AS total_rows
    ${baseFrom}
    `,
    params
  );

  const totals = totalsRes.rows[0] ?? {
    total_inspected: 0,
    total_rejected: 0,
    total_lines: 0,
    total_rows: 0,
  };

  const countRes = await db.query<{ total: number }>(
    `
    SELECT COUNT(*)::int AS total
    ${baseFrom}
    `,
    params
  );

  const totalCount = countRes.rows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const baseSelect = `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.entry_date::text AS "entryDate",
      s.name,
      s.employee_number AS "employeeNumber",
      s.shift,
      s.stock_order AS "stockOrder",
      COALESCE(s.sales_order_display, s.sales_order_base) AS "salesOrder",
      COALESCE(agg.line_count, 0) AS "lineCount",
      COALESCE(agg.total_inspected, 0) AS "totalInspected",
      COALESCE(agg.total_rejected, 0) AS "totalRejected",
      s.notes,
      COALESCE(s.is_voided, false) AS "isVoided"
    ${baseFrom}
    ORDER BY ${orderBySql}
  `;

  if (format === "csv") {
    const csvRes = await db.query<{
      id: string;
      entryTs: string;
      entryDate: string;
      name: string;
      employeeNumber: number;
      shift: string | null;
      stockOrder: boolean;
      salesOrder: string | null;
      lineCount: number;
      totalInspected: number;
      totalRejected: number;
      notes: string | null;
      isVoided: boolean;
    }>(baseSelect, params);

    const header = [
      "Date",
      "Data Timestamp",
      "Name",
      "Employee #",
      "Shift",
      "Stock Order",
      "Sales Order",
      "Line Count",
      "Total Inspected",
      "Total Rejected",
      "Notes",
      "Status",
    ];

    const lines = [
      header.join(","),
      ...csvRes.rows.map((r) =>
        [
          escCsvCell(r.entryDate),
          escCsvCell(r.entryTs),
          escCsvCell(r.name),
          escCsvCell(r.employeeNumber),
          escCsvCell(r.shift),
          escCsvCell(r.stockOrder ? "Yes" : "No"),
          escCsvCell(r.salesOrder),
          escCsvCell(r.lineCount),
          escCsvCell(r.totalInspected),
          escCsvCell(r.totalRejected),
          escCsvCell(r.notes),
          escCsvCell(r.isVoided ? "Voided" : "Active"),
        ].join(",")
      ),
    ];

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="knit-qc-all_${today}.csv"`,
      },
    });
  }

  const dataParams = [...params];
  dataParams.push(pageSize);
  const limitParam = `$${dataParams.length}`;
  dataParams.push(offset);
  const offsetParam = `$${dataParams.length}`;

  const dataRes = await db.query<{
    id: string;
    entryTs: string;
    entryDate: string;
    name: string;
    employeeNumber: number;
    shift: string | null;
    stockOrder: boolean;
    salesOrder: string | null;
    lineCount: number;
    totalInspected: number;
    totalRejected: number;
    notes: string | null;
    isVoided: boolean;
  }>(
    `
    ${baseSelect}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `,
    dataParams
  );

  return NextResponse.json({
    page,
    pageSize,
    totalCount,
    totalPages,
    rows: dataRes.rows,
    totals,
  });
}