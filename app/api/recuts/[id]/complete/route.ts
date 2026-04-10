import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getRecutRequestById, updateRecutRequest } from "@/lib/repositories/recutRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type Resp = { ok: true } | { error: string };

const POWER_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);
const USER_ROLE = "USER";

function roleValue(role: string | null | undefined) {
  return String(role || "").trim().toUpperCase();
}

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function getAuthEmployeeNumber(auth: any): number | null {
  const raw =
    auth?.employeeNumber != null
      ? auth.employeeNumber
      : auth?.userId != null
        ? auth.userId
        : null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function canCompleteRecord(auth: any, current: Awaited<ReturnType<typeof getRecutRequestById>>) {
  const role = roleValue(auth?.role);

  if (POWER_ROLES.has(role)) {
    return true;
  }

  if (role === USER_ROLE) {
    const authEmployeeNumber = getAuthEmployeeNumber(auth);
    return (
      authEmployeeNumber != null &&
      current?.requestedByEmployeeNumber != null &&
      Number(current.requestedByEmployeeNumber) === authEmployeeNumber
    );
  }

  return false;
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

    const params = await ctx.params;
    id = String(params?.id || "").trim();

    if (!id) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_COMPLETE_INVALID_ID",
        message: "Recut complete request received invalid id",
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
        message: "Recut request not found during complete action",
        recordType: "recut_requests",
        recordId: id,
      });

      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    if (!canCompleteRecord(auth as any, current)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_COMPLETE_FORBIDDEN",
        message: "User attempted to complete recut request without permission",
        recordType: "recut_requests",
        recordId: id,
        details: {
          role: (auth as any)?.role ?? null,
          requestedByEmployeeNumber: current.requestedByEmployeeNumber ?? null,
          authEmployeeNumber: getAuthEmployeeNumber(auth as any),
        },
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    if (current.isVoided) {
      return NextResponse.json<Resp>(
        { error: "Voided recut requests cannot be completed." },
        { status: 409 }
      );
    }

    if (current.isCompleted) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_COMPLETE_ALREADY_SET",
        message: "Recut request was already completed",
        recordType: "recut_requests",
        recordId: id,
      });

      return NextResponse.json<Resp>({ ok: true }, { status: 200 });
    }

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
      supervisorApprovedAt: current.supervisorApprovedAt
        ? new Date(current.supervisorApprovedAt)
        : null,
      supervisorApprovedBy: current.supervisorApprovedBy,

      warehousePrinted: !!current.warehousePrinted,
      warehousePrintedAt: current.warehousePrintedAt
        ? new Date(current.warehousePrintedAt)
        : null,
      warehousePrintedBy: current.warehousePrintedBy,

      isCompleted: true,
      completedAt: new Date(),
      completedBy: authName,

      doNotPull: !!current.doNotPull,
      doNotPullAt: current.doNotPullAt ? new Date(current.doNotPullAt) : null,
      doNotPullBy: current.doNotPullBy,
    });

    await logAuditEvent({
      req,
      auth,
      module: "RECUT",
      eventType: "RECUT_COMPLETED",
      message: "Recut request marked complete",
      recordType: "recut_requests",
      recordId: id,
      details: {
        completedBy: authName,
        salesOrder: current.salesOrder,
        salesOrderBase: current.salesOrderBase,
        designName: current.designName,
        requestedDepartment: current.requestedDepartment,
      },
    });

    await createActivityHistory({
      entityType: "recut_requests",
      entityId: id,
      eventType: "COMPLETED",
      fieldName: "isCompleted",
      previousValue: false,
      newValue: true,
      message: "Recut request marked complete",
      module: "RECUT",
      userId: (auth as any).userId != null ? String((auth as any).userId) : null,
      userName: authName,
      employeeNumber:
        (auth as any).employeeNumber != null
          ? Number((auth as any).employeeNumber)
          : null,
      salesOrder: parseSalesOrderNumber(current.salesOrder),
      detailNumber: current.detailNumber,
    });

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_COMPLETE_ERROR",
      message: "Failed to complete recut request",
      recordType: "recut_requests",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut complete POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}