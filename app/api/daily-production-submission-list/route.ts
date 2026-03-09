import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type Resp =
  | { submissions: any[]; totalCount: number; limit: number; offset: number }
  | { error: string };

function isValidYMD(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function ymdInChicago(d: Date): string {
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

// Allowed sort keys (we ORDER BY the aliased column names from the CTE)
const ALLOWED_SORT_KEYS = new Set([
  "shiftDate",
  "entryTs",
  "name",
  "employeeNumber",
  "shift",
  "machineNumber",
  "salesOrder",
  "lineCount",
  "totalStitches",
  "totalPieces",
]);

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;

  // ----- Shift date range (defaults to last 30 days) -----
  const rawFrom = sp.get("shiftDateFrom")?.trim() ?? "";
  const rawTo = sp.get("shiftDateTo")?.trim() ?? "";

  const todayChicago = ymdInChicago(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 29); // inclusive last 30 days
  const defaultFrom = ymdInChicago(d);

  const shiftDateFrom = rawFrom ? rawFrom : defaultFrom;
  const shiftDateTo = rawTo ? rawTo : todayChicago;

  if (!isValidYMD(shiftDateFrom) || !isValidYMD(shiftDateTo)) {
    return NextResponse.json<Resp>(
      { error: "Invalid shiftDateFrom/shiftDateTo (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // ----- Pagination -----
  const limit = clampInt(sp.get("limit"), 25, 1, 200);
  const offset = clampInt(sp.get("offset"), 0, 0, 1_000_000);

  // ----- Sorting -----
  const sortByRaw = sp.get("sortBy")?.trim() || "entryTs";
  const sortBy = ALLOWED_SORT_KEYS.has(sortByRaw) ? sortByRaw : "entryTs";

  const sortDirRaw = (sp.get("sortDir")?.trim() || "desc").toLowerCase();
  const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  // Stable tie-breaker so pagination is consistent
  const orderBySql =
    sortBy === "entryTs"
      ? `"entryTs" ${sortDir}, "id" DESC`
      : `"${sortBy}" ${sortDir}, "entryTs" DESC, "id" DESC`;

  try {
    // params start with date range
    const params: any[] = [shiftDateFrom, shiftDateTo];

    // range filter
    let where = `e.shift_date BETWEEN $1 AND $2 AND e.submission_id IS NOT NULL`;

    // Non-admin: restrict to their own submissions
    if (auth.role !== "ADMIN") {
      params.push(Number(auth.employeeNumber));
      where += ` AND s.employee_number = $${params.length}`;
    }

    // ---- Optional filters ----
    const name = sp.get("name")?.trim();
    if (name) {
      params.push(`%${name}%`);
      where += ` AND s.name ILIKE $${params.length}`;
    }

    const machineNumber = sp.get("machineNumber")?.trim();
    if (machineNumber) {
      // starts-with
      params.push(`${machineNumber}%`);
      where += ` AND s.machine_number::text LIKE $${params.length}`;
    }

    const salesOrder = sp.get("salesOrder")?.trim();
    if (salesOrder) {
      // starts-with
      params.push(`${salesOrder}%`);
      where += ` AND s.sales_order::text LIKE $${params.length}`;
    }

    const shift = sp.get("shift")?.trim();
    if (shift) {
      params.push(shift);
      where += ` AND s.shift = $${params.length}`;
    }

    const notes = sp.get("notes")?.trim();
    if (notes) {
      params.push(`%${notes}%`);
      where += ` AND COALESCE(s.notes,'') ILIKE $${params.length}`;
    }

    // Admin-only filter by employeeNumber (optional)
    const employeeNumber = sp.get("employeeNumber")?.trim();
    if (employeeNumber && auth.role === "ADMIN") {
      params.push(employeeNumber);
      where += ` AND s.employee_number::text = $${params.length}`;
    }

    // add pagination params
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
          MIN(e.shift_date) AS "shiftDate",
          s.name,
          s.employee_number AS "employeeNumber",
          s.shift,
          s.machine_number AS "machineNumber",
          s.sales_order AS "salesOrder",
          s.notes,
          s.created_at AS "createdAt",
          COUNT(e.id)::int AS "lineCount",
          -- ✅ FIX: stitches per piece * pieces (summed across lines)
          SUM(COALESCE(e.stitches,0) * COALESCE(e.pieces,0))::bigint AS "totalStitches",
          SUM(COALESCE(e.pieces,0))::int AS "totalPieces"
        FROM public.embroidery_daily_submissions s
        JOIN public.embroidery_daily_entries e
          ON e.submission_id = s.id
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

    const totalCount = rows.length > 0 ? Number(rows[0].totalCount) : 0;
    const submissions = rows.map(({ totalCount: _tc, ...rest }: any) => rest);

    return NextResponse.json<Resp>({ submissions, totalCount, limit, offset }, { status: 200 });
  } catch (err) {
    console.error("daily-production-submission-list GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}