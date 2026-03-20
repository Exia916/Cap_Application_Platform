import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManagerOrAdmin } from "../_shared/adminAuth";

export const runtime = "nodejs";

type SortKey =
  | "entry_date"
  | "entry_ts"
  | "name"
  | "employee_number"
  | "sales_order"
  | "detail_count"
  | "quantity";

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

export async function GET(req: Request) {
  const auth = await requireManagerOrAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);

  const entryDateFrom = searchParams.get("entryDateFrom") || "";
  const entryDateTo = searchParams.get("entryDateTo") || "";

  const name = (searchParams.get("name") || "").trim();
  const employeeNumber = (searchParams.get("employeeNumber") || "").trim();
  const salesOrder = (searchParams.get("salesOrder") || "").trim();
  const detailCount = (searchParams.get("detailCount") || "").trim();
  const quantity = (searchParams.get("quantity") || "").trim();
  const notes = (searchParams.get("notes") || "").trim();

  const page = Math.max(1, toInt(searchParams.get("page"), 1));
  const pageSize = clamp(toInt(searchParams.get("pageSize"), 25), 1, 500);
  const offset = (page - 1) * pageSize;

  const sort = (searchParams.get("sort") || "entry_ts") as SortKey;
  const dir = (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const format = (searchParams.get("format") || "").toLowerCase();

  if (!entryDateFrom || !entryDateTo) {
    return NextResponse.json(
      { error: "entryDateFrom and entryDateTo are required." },
      { status: 400 }
    );
  }

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

  if (employeeNumber) {
    params.push(`${employeeNumber}%`);
    where.push(`COALESCE(s.employee_number::text, '') LIKE $${params.length}`);
  }

  if (salesOrder) {
    params.push(`${salesOrder}%`);
    where.push(`COALESCE(s.sales_order::text, '') LIKE $${params.length}`);
  }

  if (detailCount) {
    params.push(`${detailCount}%`);
    where.push(`COALESCE(s.detail_count::text, '') LIKE $${params.length}`);
  }

  if (quantity) {
    params.push(`${quantity}%`);
    where.push(`COALESCE(s.quantity::text, '') LIKE $${params.length}`);
  }

  if (notes) {
    params.push(`%${notes}%`);
    where.push(`COALESCE(s.notes, '') ILIKE $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const ORDER_MAP: Record<SortKey, string> = {
    entry_date: "s.entry_date",
    entry_ts: "s.entry_ts",
    name: "s.name",
    employee_number: "s.employee_number",
    sales_order: "s.sales_order",
    detail_count: "s.detail_count",
    quantity: "s.quantity",
  };

  const orderExpr = ORDER_MAP[sort] ?? ORDER_MAP.entry_ts;
  const orderBySql = `${orderExpr} ${dir}, s.id DESC`;

  const totalsRes = await db.query<{
    total_quantity: number;
    total_detail_count: number;
  }>(
    `
    SELECT
      COALESCE(SUM(s.quantity), 0)::int AS total_quantity,
      COALESCE(SUM(s.detail_count), 0)::int AS total_detail_count
    FROM public.sample_embroidery_entries s
    ${whereSql}
    `,
    params
  );

  const totals = totalsRes.rows[0] ?? {
    total_quantity: 0,
    total_detail_count: 0,
  };

  const countRes = await db.query<{ total: number }>(
    `
    SELECT COUNT(*)::int AS total
    FROM public.sample_embroidery_entries s
    ${whereSql}
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
      s.sales_order::text AS "salesOrder",
      s.detail_count AS "detailCount",
      s.quantity,
      s.notes
    FROM public.sample_embroidery_entries s
    ${whereSql}
    ORDER BY ${orderBySql}
  `;

  if (format === "csv") {
    const csvRes = await db.query<{
      id: string;
      entryTs: string;
      entryDate: string;
      name: string;
      employeeNumber: number | null;
      salesOrder: string | null;
      detailCount: number;
      quantity: number;
      notes: string | null;
    }>(baseSelect, params);

    const header = [
      "Date",
      "Data Timestamp",
      "Name",
      "Employee #",
      "Sales Order",
      "Detail Count",
      "Quantity",
      "Notes",
    ];

    const lines = [
      header.join(","),
      ...csvRes.rows.map((r) =>
        [
          escCsvCell(r.entryDate),
          escCsvCell(r.entryTs),
          escCsvCell(r.name),
          escCsvCell(r.employeeNumber),
          escCsvCell(r.salesOrder),
          escCsvCell(r.detailCount),
          escCsvCell(r.quantity),
          escCsvCell(r.notes),
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
        "Content-Disposition": `attachment; filename="sample-embroidery-all_${today}.csv"`,
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
    employeeNumber: number | null;
    salesOrder: string | null;
    detailCount: number;
    quantity: number;
    notes: string | null;
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