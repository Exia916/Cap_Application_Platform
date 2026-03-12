import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listRecutRequestsForReviewPaged, type SortDir } from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

type Resp =
  | {
      rows: any[];
      total: number;
      page: number;
      pageSize: number;
    }
  | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

function parseBoolParam(v: string | null): boolean | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") || "25");
    const q = req.nextUrl.searchParams.get("q") || "";

    const recutId = req.nextUrl.searchParams.get("recutId") || "";
    const requestedDate = req.nextUrl.searchParams.get("requestedDate") || "";
    const requestedTime = req.nextUrl.searchParams.get("requestedTime") || "";
    const requestedByName = req.nextUrl.searchParams.get("requestedByName") || "";
    const requestedDepartment = req.nextUrl.searchParams.get("requestedDepartment") || "";
    const salesOrder = req.nextUrl.searchParams.get("salesOrder") || "";
    const designName = req.nextUrl.searchParams.get("designName") || "";
    const recutReason = req.nextUrl.searchParams.get("recutReason") || "";
    const detailNumber = req.nextUrl.searchParams.get("detailNumber") || "";
    const capStyle = req.nextUrl.searchParams.get("capStyle") || "";
    const pieces = req.nextUrl.searchParams.get("pieces") || "";
    const operator = req.nextUrl.searchParams.get("operator") || "";
    const deliverTo = req.nextUrl.searchParams.get("deliverTo") || "";
    const notes = req.nextUrl.searchParams.get("notes") || "";

    const event = parseBoolParam(req.nextUrl.searchParams.get("event"));
    const doNotPull = parseBoolParam(req.nextUrl.searchParams.get("doNotPull"));
    const supervisorApproved = parseBoolParam(req.nextUrl.searchParams.get("supervisorApproved"));
    const warehousePrinted = parseBoolParam(req.nextUrl.searchParams.get("warehousePrinted"));

    const sortBy = req.nextUrl.searchParams.get("sortBy") || "requestedDate";
    const sortDir = (req.nextUrl.searchParams.get("sortDir") || "desc") as SortDir;

    const result = await listRecutRequestsForReviewPaged({
      page,
      pageSize,
      q,
      recutId,
      requestedDate,
      requestedTime,
      requestedByName,
      requestedDepartment,
      salesOrder,
      designName,
      recutReason,
      detailNumber,
      capStyle,
      pieces,
      operator,
      deliverTo,
      notes,
      event,
      doNotPull,
      supervisorApproved,
      warehousePrinted,
      sortBy,
      sortDir,
    });

    return NextResponse.json<Resp>(result, { status: 200 });
  } catch (err) {
    console.error("recuts review list GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}