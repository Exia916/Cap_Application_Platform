// app/api/admin/daily-production-all/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManagerOrAdmin } from "../_shared/adminAuth";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseBoolFilter(v: string | null): boolean | null {
  // Accept: "true"/"false", "1"/"0", "TRUE"/"FALSE"
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return null;
}

function escCsv(val: any) {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const auth = await requireManagerOrAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);

  // Filters
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end"); // YYYY-MM-DD
  const showAll = searchParams.get("all") === "1";

  // ✅ Global search
  const q = (searchParams.get("q") || "").trim();

  const shift = searchParams.get("shift");
  const employeeNumber = searchParams.get("employee_number");
  const name = searchParams.get("name");
  const salesOrder = searchParams.get("sales_order");
  const machineNumber = searchParams.get("machine_number");
  const location = searchParams.get("location");
  const detailNumber = searchParams.get("detail_number");

  const is3d = parseBoolFilter(searchParams.get("is_3d"));
  const isKnit = parseBoolFilter(searchParams.get("is_knit"));
  const detailComplete = parseBoolFilter(searchParams.get("detail_complete"));

  // ✅ NEW: annex + jobber samples ran
  const annexFilter = parseBoolFilter(searchParams.get("annex"));
  const jobberSamplesRan = searchParams.get("jobber_samples_ran");

  const notes = searchParams.get("notes"); // contains
  const format = searchParams.get("format"); // "csv" or null

  // Paging / sorting
  const page = clamp(toInt(searchParams.get("page"), 1), 1, 1_000_000);
  const pageSize = clamp(toInt(searchParams.get("pageSize"), 100), 10, 500);

  // Allowlist sort fields to avoid SQL injection
  const sortFieldRaw = (searchParams.get("sort") || "entry_ts").toLowerCase();
  const sortDirRaw = (searchParams.get("dir") || "desc").toLowerCase();

  const sortFieldMap: Record<string, string> = {
    shift_date: "e.shift_date",
    entry_ts: "e.entry_ts",
    name: "e.name",
    employee_number: "e.employee_number",
    machine_number: "e.machine_number",
    sales_order: "e.sales_order",
    detail_number: "e.detail_number",
    embroidery_location: "e.embroidery_location",
    stitches: "e.stitches",
    pieces: "e.pieces",
    total_stitches: "e.total_stitches",
    dozens: "e.dozens",

    // ✅ NEW
    annex: "e.annex",
    jobber_samples_ran: "e.jobber_samples_ran",

    // derived (window)
    shift_stitches: "shift_stitches",
    shift_pieces: "shift_pieces",
    shift_stitches_by_person: "shift_stitches_by_person",
    shift_pieces_by_person: "shift_pieces_by_person",
  };

  const sortField = sortFieldMap[sortFieldRaw] || "e.entry_ts";
  const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  const where: string[] = [];
  const params: any[] = [];

  const add = (sql: string, value?: any) => {
    where.push(sql.replace("?", `$${params.length + 1}`));
    params.push(value);
  };

  // ✅ Default to last 30 days if no explicit start/end AND not showAll
  if (!showAll) {
    if (start) add(`e.shift_date >= ?::date`, start);
    if (end) add(`e.shift_date <= ?::date`, end);
    if (!start && !end) {
      where.push(`e.shift_date >= (CURRENT_DATE - INTERVAL '30 days')`);
    }
  }

  // ✅ Global search across common fields
  if (q) {
    const like = `%${q}%`;
    const p1 = `$${params.length + 1}`;
    const p2 = `$${params.length + 2}`;
    const p3 = `$${params.length + 3}`;
    const p4 = `$${params.length + 4}`;
    const p5 = `$${params.length + 5}`;
    const p6 = `$${params.length + 6}`;
    const p7 = `$${params.length + 7}`;
    const p8 = `$${params.length + 8}`;
    const p9 = `$${params.length + 9}`;
    const p10 = `$${params.length + 10}`;

    where.push(`(
      e.name ILIKE ${p1}
      OR e.shift ILIKE ${p2}
      OR e.embroidery_location ILIKE ${p3}
      OR COALESCE(e.notes, '') ILIKE ${p4}
      OR CAST(e.employee_number AS text) ILIKE ${p5}
      OR CAST(e.machine_number AS text) ILIKE ${p6}
      OR CAST(e.sales_order AS text) ILIKE ${p7}
      OR CAST(e.detail_number AS text) ILIKE ${p8}
      OR CAST(e.jobber_samples_ran AS text) ILIKE ${p9}
      OR CAST(e.annex AS text) ILIKE ${p10}
    )`);
    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  if (shift) add(`e.shift ILIKE ?`, `%${shift}%`);
  if (employeeNumber) add(`CAST(e.employee_number AS text) ILIKE ?`, `%${employeeNumber}%`);
  if (name) add(`e.name ILIKE ?`, `%${name}%`);
  if (salesOrder) add(`CAST(e.sales_order AS text) ILIKE ?`, `%${salesOrder}%`);
  if (machineNumber) add(`CAST(e.machine_number AS text) ILIKE ?`, `%${machineNumber}%`);
  if (location) add(`e.embroidery_location ILIKE ?`, `%${location}%`);
  if (detailNumber) add(`CAST(e.detail_number AS text) ILIKE ?`, `%${detailNumber}%`);

  if (is3d !== null) add(`e.is_3d = ?`, is3d);
  if (isKnit !== null) add(`e.is_knit = ?`, isKnit);
  if (detailComplete !== null) add(`e.detail_complete = ?`, detailComplete);

  if (annexFilter !== null) add(`e.annex = ?`, annexFilter);
  if (jobberSamplesRan) add(`CAST(e.jobber_samples_ran AS text) ILIKE ?`, `%${jobberSamplesRan}%`);

  if (notes) add(`COALESCE(e.notes, '') ILIKE ?`, `%${notes}%`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Base select includes derived columns via windows
  const baseSelect = `
    SELECT
      e.id,
      e.shift_date,
      e.entry_ts,
      e.name,
      e.employee_number,
      e.shift,
      e.machine_number,
      e.sales_order,
      e.detail_number,
      e.embroidery_location,
      e.stitches,
      e.pieces,
      e.is_3d,
      e.is_knit,
      e.detail_complete,

      -- ✅ NEW
      e.annex,
      e.jobber_samples_ran,

      e.notes,
      e.total_stitches,
      e.dozens,

      COALESCE(SUM(e.total_stitches) OVER (PARTITION BY e.shift_date), 0)::bigint AS shift_stitches,
      COALESCE(SUM(e.pieces) OVER (PARTITION BY e.shift_date), 0)::bigint AS shift_pieces,
      COALESCE(SUM(e.total_stitches) OVER (PARTITION BY e.shift_date, e.name), 0)::bigint AS shift_stitches_by_person,
      COALESCE(SUM(e.pieces) OVER (PARTITION BY e.shift_date, e.name), 0)::bigint AS shift_pieces_by_person

    FROM embroidery_daily_entries e
    ${whereSql}
    ORDER BY ${sortField} ${sortDir}
  `;

  // CSV export (no paging)
  if (format === "csv") {
    const { rows } = await db.query(baseSelect, params);

    const headers = [
      "shift_date",
      "entry_ts",
      "name",
      "machine_number",
      "sales_order",
      "detail_number",
      "embroidery_location",
      "stitches",
      "pieces",

      // ✅ NEW
      "annex",
      "jobber_samples_ran",

      "is_3d",
      "is_knit",
      "detail_complete",
      "notes",
      "total_stitches",
      "shift_stitches",
      "shift_pieces",
      "shift_stitches_by_person",
      "shift_pieces_by_person",
      "dozens",
      "employee_number",
      "shift",
    ];

    const lines = [headers.join(","), ...rows.map((r: any) => headers.map((h) => escCsv(r[h])).join(","))];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="daily-production-all.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Count + paged rows
  const countSql = `SELECT COUNT(*)::int AS count FROM embroidery_daily_entries e ${whereSql}`;
  const offset = (page - 1) * pageSize;
  const pagedSql = `${baseSelect} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const pagedParams = [...params, pageSize, offset];

  const totalsSql = `
    SELECT
      COALESCE(SUM(e.total_stitches), 0)::bigint AS total_stitches,
      COALESCE(SUM(e.pieces), 0)::bigint AS total_pieces,
      COALESCE(SUM(e.dozens), 0)::numeric AS total_dozens
    FROM embroidery_daily_entries e
    ${whereSql}
  `;

  const [countRes, rowsRes, totalsRes] = await Promise.all([
    db.query(countSql, params),
    db.query(pagedSql, pagedParams),
    db.query(totalsSql, params),
  ]);

  const totalCount = countRes.rows?.[0]?.count ?? 0;

  return NextResponse.json({
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    rows: rowsRes.rows,
    totals: totalsRes.rows?.[0] ?? { total_stitches: 0, total_pieces: 0, total_dozens: 0 },
  });
}