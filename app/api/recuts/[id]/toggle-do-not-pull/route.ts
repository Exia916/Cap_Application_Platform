import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getRecutRequestById, updateRecutRequest } from "@/lib/repositories/recutRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type Resp = { ok: true; doNotPull: boolean } | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "WAREHOUSE"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_DO_NOT_PULL_FORBIDDEN",
        message: "User attempted to toggle do-not-pull without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    id = String(params?.id || "").trim();

    if (!id) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_DO_NOT_PULL_INVALID_ID",
        message: "Recut do-not-pull toggle received invalid id",
        recordType: "recut_requests",
        recordId: null,
      });

      return NextResponse.json<Resp>({ error: "Invalid id" }, { status: 400 });
    }

    const current = await getRecutRequestById(id);

    if (!current) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_NOT_FOUND",
        message: "Recut request not found during do-not-pull toggle",
        recordType: "recut_requests",
        recordId: id,
      });

      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    const nextDoNotPull = !Boolean(current.doNotPull);
    const authName = String(
      (auth as any).displayName ?? (auth as any).username ?? "Unknown"
    ).trim();

    await updateRecutRequest({
      id,
      requestedDepartment: current.requestedDepartment,
      salesOrder: current.salesOrder,
      salesOrderBase: current.salesOrderBase,
      salesOrderDisplay: current.salesOrderDisplay ?? current.salesOrder,
      designName: current.designName,
      recutReason: current.recutReason,
      detailNumber: current.detailNumber,
      capStyle: current.capStyle,
      pieces: current.pieces,
      operator: current.operator,
      deliverTo: current.deliverTo,
      notes: current.notes ?? null,
      event: !!current.event,

      supervisorApproved: !!current.supervisorApproved,
      supervisorApprovedAt: current.supervisorApprovedAt ? new Date(current.supervisorApprovedAt) : null,
      supervisorApprovedBy: current.supervisorApprovedBy,

      warehousePrinted: !!current.warehousePrinted,
      warehousePrintedAt: current.warehousePrintedAt ? new Date(current.warehousePrintedAt) : null,
      warehousePrintedBy: current.warehousePrintedBy,

      doNotPull: nextDoNotPull,
      doNotPullAt: nextDoNotPull ? new Date() : null,
      doNotPullBy: nextDoNotPull ? authName : null,
    });

    await logAuditEvent({
      req,
      auth,
      module: "RECUT",
      eventType: nextDoNotPull ? "RECUT_DO_NOT_PULL_SET" : "RECUT_DO_NOT_PULL_REMOVED",
      message: nextDoNotPull
        ? "Recut request marked do not pull"
        : "Recut request do not pull removed",
      recordType: "recut_requests",
      recordId: id,
      details: {
        doNotPull: nextDoNotPull,
        changedBy: authName,
        salesOrder: current.salesOrder,
        salesOrderBase: current.salesOrderBase,
        designName: current.designName,
        requestedDepartment: current.requestedDepartment,
      },
    });

    await createActivityHistory({
      entityType: "recut_requests",
      entityId: id,
      eventType: nextDoNotPull ? "DO_NOT_PULL_SET" : "DO_NOT_PULL_REMOVED",
      fieldName: "doNotPull",
      previousValue: !!current.doNotPull,
      newValue: nextDoNotPull,
      message: nextDoNotPull
        ? "Recut request marked do not pull"
        : "Recut request do not pull removed",
      module: "RECUT",
      userId: (auth as any).userId != null ? String((auth as any).userId) : null,
      userName: authName,
      employeeNumber:
        (auth as any).employeeNumber != null ? Number((auth as any).employeeNumber) : null,
      salesOrder: parseSalesOrderNumber(current.salesOrder),
      detailNumber: current.detailNumber,
    });

    return NextResponse.json<Resp>(
      { ok: true, doNotPull: nextDoNotPull },
      { status: 200 }
    );
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_DO_NOT_PULL_ERROR",
      message: "Failed to toggle recut do-not-pull flag",
      recordType: "recut_requests",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut toggle do-not-pull POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}