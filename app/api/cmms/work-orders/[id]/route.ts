import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getWorkOrderById, updateWorkOrderRequesterFields } from "@/lib/repositories/cmmsRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "TECH"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").toUpperCase());
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let id: number | null = null;

  try {
    auth = getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_DETAIL_FORBIDDEN",
        message: "User attempted to view CMMS work order detail without permission",
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await ctx.params;
    id = toInt(idStr);

    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await getWorkOrderById(id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(row, { status: 200 });
  } catch (e: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "CMMS",
      eventType: "CMMS_WORK_ORDER_DETAIL_ERROR",
      message: "Failed to load CMMS work order detail",
      recordType: "cmms_work_orders",
      recordId: id,
      error: e,
      details: {
        code: e?.code ?? null,
        detail: e?.detail ?? null,
      },
    });

    console.error("CMMS GET /work-orders/[id] failed:", e);

    return NextResponse.json(
      { error: e?.message || "Failed to load work order", code: e?.code, detail: e?.detail },
      { status: 500 }
    );
  }
}

// requester edits only (protect tech fields)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let id: number | null = null;

  try {
    auth = getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_UPDATE_FORBIDDEN",
        message: "User attempted to update CMMS work order requester fields without permission",
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idStr } = await ctx.params;
    id = toInt(idStr);

    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const departmentId = toInt((body as any).departmentId);
    const assetId = toInt((body as any).assetId);
    const priorityId = toInt((body as any).priorityId);
    const commonIssueId = toInt((body as any).commonIssueId);
    const operatorInitials = String((body as any).operatorInitials || "").trim() || null;
    const issueDialogue = String((body as any).issueDialogue || "").trim();

    const missing: string[] = [];
    if (!departmentId) missing.push("departmentId");
    if (!assetId) missing.push("assetId");
    if (!priorityId) missing.push("priorityId");
    if (!commonIssueId) missing.push("commonIssueId");
    if (!issueDialogue) missing.push("issueDialogue");

    if (missing.length) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "CMMS",
        eventType: "CMMS_WORK_ORDER_UPDATE_INVALID",
        message: "CMMS work order requester update failed validation",
        recordType: "cmms_work_orders",
        recordId: id,
        details: {
          missingFields: missing,
        },
      });

      return NextResponse.json(
        { error: `Missing/invalid fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const activityActor = buildActivityActor(auth);

    const updated = await updateWorkOrderRequesterFields({
      id,
      departmentId,
      assetId,
      priorityId,
      commonIssueId,
      operatorInitials,
      issueDialogue,
      activityActor,
    });

    await logAuditEvent({
      req,
      auth,
      module: "CMMS",
      eventType: "CMMS_WORK_ORDER_UPDATED",
      message: "CMMS work order requester fields updated",
      recordType: "cmms_work_orders",
      recordId: updated.workOrderId,
      details: {
        departmentId,
        assetId,
        priorityId,
        commonIssueId,
        operatorInitials,
      },
    });

    return NextResponse.json({ ok: true, workOrderId: updated.workOrderId }, { status: 200 });
  } catch (e: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "CMMS",
      eventType: "CMMS_WORK_ORDER_UPDATE_ERROR",
      message: "Failed to update CMMS work order requester fields",
      recordType: "cmms_work_orders",
      recordId: id,
      error: e,
      details: {
        code: e?.code ?? null,
        detail: e?.detail ?? null,
      },
    });

    console.error("CMMS PATCH /work-orders/[id] failed:", e);

    const msg = e?.detail
      ? `${e?.message || "Update failed"} — ${e.detail}`
      : e?.message || "Update failed";

    return NextResponse.json(
      { error: msg, code: e?.code, detail: e?.detail },
      { status: 500 }
    );
  }
}