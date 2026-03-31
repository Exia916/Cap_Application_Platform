import { NextRequest, NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../_shared/adminAuth";
import { listWorkSessionsAllView } from "@/lib/repositories/productionWorkSessionRepo";

export const runtime = "nodejs";

type SortBy =
  | "workDate"
  | "timeIn"
  | "timeOut"
  | "operatorName"
  | "employeeNumber"
  | "moduleKey"
  | "areaCode"
  | "shift"
  | "isOpen"
  | "submissionCount"
  | "totalQuantity";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function normalizeSortBy(value: string | null): SortBy {
  switch (String(value ?? "").trim()) {
    case "workDate":
      return "workDate";
    case "timeIn":
      return "timeIn";
    case "timeOut":
      return "timeOut";
    case "operatorName":
      return "operatorName";
    case "employeeNumber":
      return "employeeNumber";
    case "moduleKey":
      return "moduleKey";
    case "areaCode":
      return "areaCode";
    case "shift":
      return "shift";
    case "isOpen":
      return "isOpen";
    case "submissionCount":
      return "submissionCount";
    case "totalQuantity":
      return "totalQuantity";
    default:
      return "timeIn";
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireManagerOrAdmin();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const defaults = defaultDateRange();

    const workDateFrom = isYmd(searchParams.get("workDateFrom"))
      ? String(searchParams.get("workDateFrom"))
      : defaults.from;

    const workDateTo = isYmd(searchParams.get("workDateTo"))
      ? String(searchParams.get("workDateTo"))
      : defaults.to;

    const moduleKey = (searchParams.get("moduleKey") || "").trim() || undefined;
    const areaCode = (searchParams.get("areaCode") || "").trim() || undefined;
    const operatorName = (searchParams.get("operatorName") || "").trim() || undefined;

    const employeeNumberRaw = (searchParams.get("employeeNumber") || "").trim();
    const employeeNumber =
      employeeNumberRaw && Number.isFinite(Number(employeeNumberRaw))
        ? Number(employeeNumberRaw)
        : undefined;

    const isOpenRaw = (searchParams.get("isOpen") || "").trim().toLowerCase();
    const isOpen =
      isOpenRaw === "true" ? true : isOpenRaw === "false" ? false : undefined;

    const limit = clamp(toInt(searchParams.get("limit"), 25), 1, 200);
    const offset = Math.max(0, toInt(searchParams.get("offset"), 0));

    const sortBy = normalizeSortBy(searchParams.get("sortBy"));
    const sortDir =
      (searchParams.get("sortDir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const data = await listWorkSessionsAllView({
      workDateFrom,
      workDateTo,
      moduleKey,
      areaCode,
      operatorName,
      employeeNumber,
      isOpen,
      limit,
      offset,
      sortBy,
      sortDir,
      includeVoided: true,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load work sessions all-view." },
      { status: 500 }
    );
  }
}