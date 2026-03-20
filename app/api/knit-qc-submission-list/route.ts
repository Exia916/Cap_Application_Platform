import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listKnitQcSubmissionSummariesRange,
  type KnitQcSubmissionSummaryRow,
} from "@/lib/repositories/knitQcRepo";
import { logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type Resp =
  | {
      submissions: KnitQcSubmissionSummaryRow[];
      totalCount: number;
    }
  | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

function parseSortDir(value: string | null): "asc" | "desc" {
  return String(value ?? "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function parseSortBy(
  value: string | null
):
  | "entryDate"
  | "entryTs"
  | "name"
  | "shift"
  | "stockOrder"
  | "salesOrder"
  | "lineCount"
  | "totalInspected"
  | "totalRejected"
  | "isVoided" {
  const v = String(value ?? "").trim();

  const allowed = new Set([
    "entryDate",
    "entryTs",
    "name",
    "shift",
    "stockOrder",
    "salesOrder",
    "lineCount",
    "totalInspected",
    "totalRejected",
    "isVoided",
  ]);

  return allowed.has(v) ? (v as any) : "entryTs";
}

function parseBooleanFilter(value: string | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function trimmed(value: string | null): string | undefined {
  const s = String(value ?? "").trim();
  return s || undefined;
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
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, VIEW_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_QC",
        eventType: "KNIT_QC_LIST_FORBIDDEN",
        message: "User attempted to view knit QC list without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const defaults = defaultDateRange();

    const entryDateFrom = isYmd(sp.get("entryDateFrom"))
      ? String(sp.get("entryDateFrom"))
      : defaults.from;

    const entryDateTo = isYmd(sp.get("entryDateTo"))
      ? String(sp.get("entryDateTo"))
      : defaults.to;

    const sortBy = parseSortBy(sp.get("sortBy"));
    const sortDir = parseSortDir(sp.get("sortDir"));
    const limit = Math.max(1, Math.min(200, parsePositiveInt(sp.get("limit"), 25)));
    const offset = Math.max(0, parsePositiveInt(sp.get("offset"), 0));

    const role = String(auth.role ?? "").trim().toUpperCase();
    const isPowerUser = role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";

    const includeVoided = isPowerUser && sp.get("includeVoided") === "true";
    const onlyVoided = isPowerUser && sp.get("onlyVoided") === "true";

    const employeeNumber =
      !isPowerUser && auth.employeeNumber != null && Number.isFinite(Number(auth.employeeNumber))
        ? Number(auth.employeeNumber)
        : undefined;

    const result = await listKnitQcSubmissionSummariesRange({
      entryDateFrom,
      entryDateTo,
      employeeNumber,
      name: trimmed(sp.get("name")),
      salesOrderStartsWith: trimmed(sp.get("salesOrder")),
      notes: trimmed(sp.get("notes")),
      stockOrder: parseBooleanFilter(sp.get("stockOrder")),
      includeVoided,
      onlyVoided,
      sortBy,
      sortDir,
      limit,
      offset,
    });

    return NextResponse.json<Resp>(
      {
        submissions: result.rows,
        totalCount: result.totalCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_QC",
      eventType: "KNIT_QC_LIST_ERROR",
      message: "Failed to load knit QC submissions",
      recordType: "knit_qc_submissions",
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-qc-submission-list GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}