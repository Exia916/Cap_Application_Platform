import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { updateWorkOrderTechFields } from "@/lib/repositories/cmmsRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

const ALLOWED = new Set(["ADMIN", "TECH"]);

function ok(role: any) {
  return ALLOWED.has(String(role || "").toUpperCase());
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function buildActivityActor(auth: ReturnType<typeof getAuthFromRequest>) {
  const rawEmp =
    (auth as any)?.employeeNumber ??
    (auth as any)?.employee_number ??
    null;

  const empNum = Number(rawEmp);

  return {
    userId: String(
      (auth as any)?.userId ??
        (auth as any)?.id ??
        (auth as any)?.username ??
        ""
    ).trim() || null,

    userName:
      String(
        (auth as any)?.displayName ??
          (auth as any)?.name ??
          (auth as any)?.username ??
          ""
      ).trim() || null,

    employeeNumber: Number.isFinite(empNum) ? Math.trunc(empNum) : null,
  };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let id: number | null = null;

  try {
    auth = getAuthFromRequest(req);
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!ok((auth as any).role)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_TECH_UPDATE_FORBIDDEN",
        message: "User attempted to update CMMS tech fields without permission",
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await ctx.params;
    id = toInt(idStr);
    if (!id) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_TECH_UPDATE_INVALID_ID",
        message: "CMMS tech update received invalid work order id",
        recordType: "cmms_work_orders",
        recordId: idStr,
      });

      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_TECH_UPDATE_INVALID_BODY",
        message: "CMMS tech update received invalid JSON body",
        recordType: "cmms_work_orders",
        recordId: id,
      });

      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const typeId =
      (body as any).typeId === "" || (body as any).typeId == null
        ? null
        : toInt((body as any).typeId);

    const techId =
      (body as any).techId === "" || (body as any).techId == null
        ? null
        : toInt((body as any).techId);

    const statusId =
      (body as any).statusId === "" || (body as any).statusId == null
        ? null
        : toInt((body as any).statusId);

    const resolution = String((body as any).resolution || "").trim() || null;
    const downTimeRecorded = String((body as any).downTimeRecorded || "").trim() || null;

    const activityActor = buildActivityActor(auth);

    const updated = await updateWorkOrderTechFields({
      id,
      typeId: typeId ?? null,
      techId: techId ?? null,
      statusId: statusId ?? null,
      resolution,
      downTimeRecorded,
      activityActor,
    });

    await logAuditEvent({
      req,
      auth,
      module: "CMMS",
      eventType: "CMMS_WORK_ORDER_TECH_UPDATED",
      message: "CMMS work order tech fields updated",
      recordType: "cmms_work_orders",
      recordId: updated.workOrderId,
      details: {
        typeId,
        techId,
        statusId,
        hasResolution: Boolean(resolution),
        hasDownTimeRecorded: Boolean(downTimeRecorded),
      },
    });

    if (statusId !== null) {
      await logAuditEvent({
        req,
        auth,
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_STATUS_CHANGED",
        message: "CMMS work order status changed",
        recordType: "cmms_work_orders",
        recordId: updated.workOrderId,
        details: {
          statusId,
        },
      });
    }

    if (resolution) {
      await logAuditEvent({
        req,
        auth,
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_RESOLUTION_ADDED",
        message: "CMMS work order resolution updated",
        recordType: "cmms_work_orders",
        recordId: updated.workOrderId,
        details: {
          resolutionLength: resolution.length,
        },
      });
    }

    if (downTimeRecorded) {
      await logAuditEvent({
        req,
        auth,
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_DOWNTIME_RECORDED",
        message: "CMMS work order downtime recorded",
        recordType: "cmms_work_orders",
        recordId: updated.workOrderId,
        details: {
          downTimeRecorded,
        },
      });
    }

    return NextResponse.json({ ok: true, workOrderId: updated.workOrderId }, { status: 200 });
  } catch (e: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "CMMS",
      eventType: "CMMS_WORK_ORDER_TECH_UPDATE_ERROR",
      message: "Failed to update CMMS work order tech fields",
      recordType: "cmms_work_orders",
      recordId: id,
      error: e,
      details: {
        code: e?.code ?? null,
        detail: e?.detail ?? null,
      },
    });

    console.error("CMMS TECH PATCH /work-orders/[id] failed:", e);

    return NextResponse.json(
      { error: e?.message || "Update failed", code: e?.code, detail: e?.detail },
      { status: 500 }
    );
  }
}