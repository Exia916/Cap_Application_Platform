import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type Resp =
  | { submissions: any[]; totalCount: number; limit: number; offset: number }
  | { error: string };

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
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

const ALLOWED_SORT = new Set(["entryTs", "entryDate", "name", "salesOrder", "lineCount", "totalPieces"]);

export async function GET(req: NextRequest) {
  try {
    // ✅ Use the same auth helper as the rest of the app
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;

    // ----- Date range (default last 30 days)
    const rawFrom = sp.get("entryDateFrom")?.trim() ?? "";
    const rawTo = sp.get("entryDateTo")?.trim() ?? "";

    const today = ymdChicago(new Date());
    const d = new Date();
    d.setDate(d.getDate() - 29);
    const defaultFrom = ymdChicago(d);

    const entryDateFrom = rawFrom || defaultFrom;
    const entryDateTo = rawTo || today;

    if (!isValidDate(entryDateFrom) || !isValidDate(entryDateTo)) {
      return NextResponse.json<Resp>({ error: "Invalid date range" }, { status: 400 });
    }

    // ----- Paging
    const limit = clampInt(sp.get("limit"), 25, 1, 200);
    const offset = clampInt(sp.get("offset"), 0, 0, 1_000_000);

    // ----- Sort
    const sortByRaw = (sp.get("sortBy") ?? "entryTs").trim();
    const sortBy = ALLOWED_SORT.has(sortByRaw) ? sortByRaw : "entryTs";
    const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

    // ----- Filters
    const name = sp.get("name")?.trim();
    const salesOrder = sp.get("salesOrder")?.trim();
    const notes = sp.get("notes")?.trim();

    const params: any[] = [entryDateFrom, entryDateTo];
    let where = `s.entry_date BETWEEN $1::date AND $2::date`;

    // ✅ Non-admin: restrict to their own submissions
    if (String(auth.role || "").toUpperCase() !== "ADMIN") {
      params.push(Number(auth.employeeNumber));
      where += ` AND s.employee_number = $${params.length}`;
    }

    if (name) {
      params.push(`%${name}%`);
      where += ` AND s.name ILIKE $${params.length}`;
    }

    if (salesOrder) {
      params.push(`${salesOrder}%`);
      where += ` AND COALESCE(s.sales_order::text,'') LIKE $${params.length}`;
    }

    if (notes) {
      params.push(`%${notes}%`);
      where += ` AND COALESCE(s.notes,'') ILIKE $${params.length}`;
    }

    const ORDER_MAP: Record<string, string> = {
      entryTs: `b."entryTs"`,
      entryDate: `b."entryDate"`,
      name: `b."name"`,
      salesOrder: `b."salesOrder"`,
      lineCount: `b."lineCount"`,
      totalPieces: `b."totalPieces"`,
    };

    const orderExpr = ORDER_MAP[sortBy] ?? ORDER_MAP.entryTs;
    const orderBySql = `${orderExpr} ${sortDir}, b."id" DESC`;

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const { rows } = await db.query(
      `
      WITH base AS (
        SELECT
          s.id,
          s.entry_ts AS "entryTs",
          s.entry_date AS "entryDate",
          s.sales_order::text AS "salesOrder",
          s.name,
          s.employee_number AS "employeeNumber",
          s.notes,
          COUNT(l.id)::int AS "lineCount",
          COALESCE(SUM(l.pieces),0)::int AS "totalPieces"
        FROM emblem_daily_submissions s
        LEFT JOIN emblem_daily_submission_lines l
          ON l.submission_id = s.id
        WHERE ${where}
        GROUP BY s.id
      )
      SELECT
        b.*,
        (SELECT COUNT(*) FROM base)::int AS "totalCount"
      FROM base b
      ORDER BY ${orderBySql}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
      `,
      params
    );

    const totalCount = rows.length ? Number(rows[0].totalCount) : 0;
    const clean = rows.map(({ totalCount: _tc, ...rest }: any) => rest);

    return NextResponse.json<Resp>({ submissions: clean, totalCount, limit, offset }, { status: 200 });
  } catch (err: any) {
    console.error("emblem-production-submission-list GET error:", err);
    return NextResponse.json<Resp>({ error: err?.message || "Server error" }, { status: 500 });
  }
}