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
  | "knit_area"
  | "detail_number"
  | "item_style"
  | "logo"
  | "quantity"
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

  const q = (searchParams.get("q") || "").trim();
  const name = (searchParams.get("name") || "").trim();
  const employeeNumberRaw = (searchParams.get("employeeNumber") || "").trim();
  const salesOrder = (searchParams.get("salesOrder") || "").trim();
  const knitArea = (searchParams.get("knitArea") || "").trim();
  const detailNumberRaw = (searchParams.get("detailNumber") || "").trim();
  const itemStyle = (searchParams.get("itemStyle") || "").trim();
  const logo = (searchParams.get("logo") || "").trim();
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
  where.push(`l.entry_date >= $${params.length}::date`);

  params.push(entryDateTo);
  where.push(`l.entry_date <= $${params.length}::date`);

  if (q) {
    params.push(`%${q}%`);
    const qp = `$${params.length}`;
    where.push(`
      (
        l.name ILIKE ${qp}
        OR COALESCE(l.employee_number::text, '') LIKE ${qp}
        OR COALESCE(l.sales_order_display, '') ILIKE ${qp}
        OR COALESCE(l.sales_order_base, '') ILIKE ${qp}
        OR COALESCE(l.knit_area, '') ILIKE ${qp}
        OR COALESCE(l.detail_number::text, '') LIKE ${qp}
        OR COALESCE(l.item_style, '') ILIKE ${qp}
        OR COALESCE(l.logo, '') ILIKE ${qp}
        OR COALESCE(l.line_notes, '') ILIKE ${qp}
        OR COALESCE(l.shift, '') ILIKE ${qp}
      )
    `);
  }

  if (name) {
    params.push(`%${name}%`);
    where.push(`l.name ILIKE $${params.length}`);
  }

  if (employeeNumberRaw) {
    params.push(`${employeeNumberRaw}%`);
    where.push(`COALESCE(l.employee_number::text, '') LIKE $${params.length}`);
  }

  if (salesOrder) {
    params.push(`${salesOrder}%`);
    where.push(
      `(COALESCE(l.sales_order_display, '') ILIKE $${params.length} OR COALESCE(l.sales_order_base, '') ILIKE $${params.length})`
    );
  }

  if (knitArea) {
    params.push(`%${knitArea}%`);
    where.push(`COALESCE(l.knit_area, '') ILIKE $${params.length}`);
  }

  if (detailNumberRaw) {
    params.push(`${detailNumberRaw}%`);
    where.push(`COALESCE(l.detail_number::text, '') LIKE $${params.length}`);
  }

  if (itemStyle) {
    params.push(`%${itemStyle}%`);
    where.push(`COALESCE(l.item_style, '') ILIKE $${params.length}`);
  }

  if (logo) {
    params.push(`%${logo}%`);
    where.push(`COALESCE(l.logo, '') ILIKE $${params.length}`);
  }

  if (notes) {
    params.push(`%${notes}%`);
    where.push(`COALESCE(l.line_notes, '') ILIKE $${params.length}`);
  }

  if (stockOrder !== null) {
    params.push(stockOrder);
    where.push(`l.stock_order = $${params.length}`);
  }

  if (onlyVoided) {
    where.push(`COALESCE(s.is_voided, false) = true`);
  } else if (!includeVoided) {
    where.push(`COALESCE(s.is_voided, false) = false`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const ORDER_MAP: Record<SortKey, string> = {
    entry_date: "l.entry_date",
    entry_ts: "l.entry_ts",
    name: "l.name",
    employee_number: "l.employee_number",
    shift: "l.shift",
    stock_order: "l.stock_order",
    sales_order: "COALESCE(l.sales_order_display, l.sales_order_base)",
    knit_area: "l.knit_area",
    detail_number: "l.detail_number",
    item_style: "l.item_style",
    logo: "l.logo",
    quantity: "l.quantity",
    is_voided: "COALESCE(s.is_voided, false)",
  };

  const orderExpr = ORDER_MAP[sort] ?? ORDER_MAP.entry_ts;
  const orderBySql = `${orderExpr} ${dir}, l.entry_ts DESC, l.id DESC`;

  const baseFrom = `
    FROM public.knit_production_lines l
    INNER JOIN public.knit_production_submissions s
      ON s.id = l.submission_id
    ${whereSql}
  `;

  const totalsRes = await db.query<{
    total_quantity: number;
    total_lines: number;
    total_rows: number;
  }>(
    `
    SELECT
      COALESCE(SUM(COALESCE(l.quantity, 0)), 0)::int AS total_quantity,
      COUNT(*)::int AS total_lines,
      COUNT(*)::int AS total_rows
    ${baseFrom}
    `,
    params
  );

  const totals = totalsRes.rows[0] ?? {
    total_quantity: 0,
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
      l.id,
      l.submission_id AS "submissionId",
      l.entry_ts AS "entryTs",
      l.entry_date::text AS "entryDate",
      l.name,
      l.employee_number AS "employeeNumber",
      l.shift,
      l.stock_order AS "stockOrder",
      COALESCE(l.sales_order_display, l.sales_order_base) AS "salesOrder",
      l.knit_area AS "knitArea",
      l.detail_number AS "detailNumber",
      l.item_style AS "itemStyle",
      l.logo,
      COALESCE(l.quantity, 0) AS "quantity",
      l.line_notes AS "notes",
      COALESCE(s.is_voided, false) AS "isVoided"
    ${baseFrom}
    ORDER BY ${orderBySql}
  `;

  if (format === "csv") {
    const csvRes = await db.query<{
      id: string;
      submissionId: string;
      entryTs: string;
      entryDate: string;
      name: string;
      employeeNumber: number;
      shift: string | null;
      stockOrder: boolean;
      salesOrder: string | null;
      knitArea: string | null;
      detailNumber: number | null;
      itemStyle: string | null;
      logo: string | null;
      quantity: number;
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
      "Knit Area",
      "Detail #",
      "Item Style",
      "Logo",
      "Quantity",
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
          escCsvCell(r.knitArea),
          escCsvCell(r.detailNumber),
          escCsvCell(r.itemStyle),
          escCsvCell(r.logo),
          escCsvCell(r.quantity),
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
        "Content-Disposition": `attachment; filename="knit-production-all_${today}.csv"`,
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
    submissionId: string;
    entryTs: string;
    entryDate: string;
    name: string;
    employeeNumber: number;
    shift: string | null;
    stockOrder: boolean;
    salesOrder: string | null;
    knitArea: string | null;
    detailNumber: number | null;
    itemStyle: string | null;
    logo: string | null;
    quantity: number;
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