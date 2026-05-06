import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listQCSubmissionSummariesRange } from "@/lib/repositories/qcRepo";

type Resp =
  | { submissions: any[]; totalCount: number; limit: number; offset: number }
  | { error: string };

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

const ALLOWED_SORT = new Set([
  "entryTs",
  "entryDate",
  "name",
  "salesOrder",
  "lineCount",
]);

const QC_ACCESS_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function canAccessAllQc(role: string | null | undefined) {
  return QC_ACCESS_ROLES.has(String(role || "").trim().toUpperCase());
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }

  const authAny = auth as any;
  const sp = req.nextUrl.searchParams;

  // Defaults: last 30 days
  const rawFrom = sp.get("entryDateFrom")?.trim() ?? "";
  const rawTo = sp.get("entryDateTo")?.trim() ?? "";

  const today = ymdChicago(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 29);
  const defaultFrom = ymdChicago(d);

  const entryDateFrom = rawFrom || defaultFrom;
  const entryDateTo = rawTo || today;

  if (!isValidDate(entryDateFrom) || !isValidDate(entryDateTo)) {
    return NextResponse.json<Resp>(
      { error: "Missing or invalid entryDateFrom/entryDateTo (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const limit = clampInt(sp.get("limit"), 25, 1, 200);
  const offset = clampInt(sp.get("offset"), 0, 0, 1_000_000);

  const sortByRaw = sp.get("sortBy")?.trim() || "entryTs";
  const sortBy = (ALLOWED_SORT.has(sortByRaw) ? sortByRaw : "entryTs") as
    | "entryTs"
    | "entryDate"
    | "name"
    | "salesOrder"
    | "lineCount";

  const sortDir =
    (sp.get("sortDir")?.trim() || "desc").toLowerCase() === "asc"
      ? "asc"
      : "desc";

  // Filters
  const name = sp.get("name")?.trim() ?? "";
  const notes = sp.get("notes")?.trim() ?? "";
  const salesOrderNumber = sp.get("salesOrderNumber")?.trim() ?? ""; // starts-with
  const detailNumber = sp.get("detailNumber")?.trim() ?? ""; // starts-with (exists on any line)

  try {
    const canAccessAll = canAccessAllQc(authAny.role);

    const result = canAccessAll
      ? await listQCSubmissionSummariesRange({
          entryDateFrom,
          entryDateTo,
          name,
          notes,
          salesOrderStartsWith: salesOrderNumber,
          detailStartsWith: detailNumber,
          sortBy,
          sortDir,
          limit,
          offset,
        })
      : await listQCSubmissionSummariesRange({
          entryDateFrom,
          entryDateTo,
          employeeNumber: Number(authAny.employeeNumber),
          name,
          notes,
          salesOrderStartsWith: salesOrderNumber,
          detailStartsWith: detailNumber,
          sortBy,
          sortDir,
          limit,
          offset,
        });

    return NextResponse.json<Resp>(
      {
        submissions: result.rows,
        totalCount: result.totalCount,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("qc-daily-production-submission-list GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}