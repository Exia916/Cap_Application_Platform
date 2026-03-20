import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canUserEditOwnRecutRequest,
  getRecutRequestById,
  updateRecutRequest,
  type RecutRequestRow,
} from "@/lib/repositories/recutRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";
import { normalizeSalesOrder } from "@/lib/utils/salesOrder";

export const runtime = "nodejs";

type GetResp = { entry: RecutRequestRow } | { error: string };
type PutResp = { ok: true } | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER", "WAREHOUSE"]);
const POWER_EDIT_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

function normalizeDept(value: string | null | undefined): string {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "EMBROIDERY") return "Embroidery";
  if (v === "ANNEX EMB") return "Annex Embroidery";
  if (v === "ANNEX EMBROIDERY") return "Annex Embroidery";
  if (v === "SAMPLE EMBROIDERY") return "Sample Embroidery";
  if (v === "QC") return "QC";
  return "";
}

function isEmbDept(value: string | null | undefined) {
  const v = normalizeDept(value);
  return v === "Embroidery" || v === "Annex Embroidery" || v === "Sample Embroidery";
}

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

type ChangeRow = {
  fieldName: string;
  label: string;
  previousValue: unknown;
  newValue: unknown;
};

function buildChanges(
  current: RecutRequestRow,
  next: {
    requestedDepartment: string;
    salesOrder: string;
    designName: string;
    recutReason: string;
    detailNumber: number;
    capStyle: string;
    pieces: number;
    operator: string;
    deliverTo: string;
    notes: string | null;
    event: boolean;
    supervisorApproved: boolean;
    warehousePrinted: boolean;
    doNotPull: boolean;
  }
) {
  const candidates: ChangeRow[] = [
    {
      fieldName: "requestedDepartment",
      label: "Requested Department",
      previousValue: current.requestedDepartment,
      newValue: next.requestedDepartment,
    },
    {
      fieldName: "salesOrder",
      label: "Sales Order",
      previousValue: current.salesOrder,
      newValue: next.salesOrder,
    },
    {
      fieldName: "designName",
      label: "Design Name",
      previousValue: current.designName,
      newValue: next.designName,
    },
    {
      fieldName: "recutReason",
      label: "Recut Reason",
      previousValue: current.recutReason,
      newValue: next.recutReason,
    },
    {
      fieldName: "detailNumber",
      label: "Detail #",
      previousValue: current.detailNumber,
      newValue: next.detailNumber,
    },
    {
      fieldName: "capStyle",
      label: "Cap Style",
      previousValue: current.capStyle,
      newValue: next.capStyle,
    },
    {
      fieldName: "pieces",
      label: "Pieces",
      previousValue: current.pieces,
      newValue: next.pieces,
    },
    {
      fieldName: "operator",
      label: "Operator",
      previousValue: current.operator,
      newValue: next.operator,
    },
    {
      fieldName: "deliverTo",
      label: "Deliver To",
      previousValue: current.deliverTo,
      newValue: next.deliverTo,
    },
    {
      fieldName: "notes",
      label: "Notes",
      previousValue: current.notes ?? null,
      newValue: next.notes ?? null,
    },
    {
      fieldName: "event",
      label: "Event",
      previousValue: !!current.event,
      newValue: !!next.event,
    },
    {
      fieldName: "supervisorApproved",
      label: "Supervisor Approved",
      previousValue: !!current.supervisorApproved,
      newValue: !!next.supervisorApproved,
    },
    {
      fieldName: "warehousePrinted",
      label: "Warehouse Printed",
      previousValue: !!current.warehousePrinted,
      newValue: !!next.warehousePrinted,
    },
    {
      fieldName: "doNotPull",
      label: "Do Not Pull",
      previousValue: !!current.doNotPull,
      newValue: !!next.doNotPull,
    },
  ];

  return candidates.filter((x) => !same(x.previousValue, x.newValue));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<GetResp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role, VIEW_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_VIEW_FORBIDDEN",
        message: "User attempted to view recut request without permission",
      });

      return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    id = String(params?.id || "").trim();

    if (!id) {
      return NextResponse.json<GetResp>({ error: "Invalid id" }, { status: 400 });
    }

    const entry = await getRecutRequestById(id);

    if (!entry) {
      return NextResponse.json<GetResp>({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json<GetResp>({ entry }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_VIEW_ERROR",
      message: "Failed to load recut request",
      recordType: "recut_requests",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut GET error:", err);
    return NextResponse.json<GetResp>({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<PutResp>({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String((auth as any).role || "").trim().toUpperCase();

    if (!roleOk(role, new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]))) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_UPDATE_FORBIDDEN",
        message: "User attempted to update recut request without permission",
      });

      return NextResponse.json<PutResp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    id = String(params?.id || "").trim();

    if (!id) {
      return NextResponse.json<PutResp>({ error: "Invalid id" }, { status: 400 });
    }

    const current = await getRecutRequestById(id);

    if (!current) {
      return NextResponse.json<PutResp>({ error: "Not found" }, { status: 404 });
    }

    const isPowerEditor = POWER_EDIT_ROLES.has(role);

    if (!isPowerEditor) {
      const employeeNumber =
        (auth as any).employeeNumber != null
          ? Number((auth as any).employeeNumber)
          : null;

      if (!employeeNumber || !Number.isFinite(employeeNumber)) {
        return NextResponse.json<PutResp>(
          { error: "Missing employee number in auth payload." },
          { status: 400 }
        );
      }

      const canEditOwn = await canUserEditOwnRecutRequest({
        id,
        employeeNumber,
      });

      if (!canEditOwn) {
        return NextResponse.json<PutResp>(
          {
            error:
              "You can only edit your own active recut requests before they are approved or printed.",
          },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json<PutResp>({ error: "Invalid request body." }, { status: 400 });
    }

    const requestedDepartment = String((body as any).requestedDepartment ?? "").trim();
    const rawSalesOrder = String((body as any).salesOrder ?? "").trim();
    const designName = String((body as any).designName ?? "").trim();
    const recutReason = String((body as any).recutReason ?? "").trim();
    const detailNumber = Number((body as any).detailNumber);
    const capStyle = String((body as any).capStyle ?? "").trim();
    const pieces = Number((body as any).pieces);
    let operator = String((body as any).operator ?? "").trim();
    const deliverTo = String((body as any).deliverTo ?? "").trim();
    const notesRaw = String((body as any).notes ?? "").trim();
    const notes = notesRaw || null;
    const event = !!(body as any).event;

    if (!requestedDepartment) {
      return NextResponse.json<PutResp>(
        { error: "Requested Department is required." },
        { status: 400 }
      );
    }

    const normalizedSO = normalizeSalesOrder(rawSalesOrder);
    if (!normalizedSO.isValid || !normalizedSO.salesOrderDisplay || !normalizedSO.salesOrderBase) {
      return NextResponse.json<PutResp>(
        { error: normalizedSO.error ?? "Sales Order must begin with 7 digits." },
        { status: 400 }
      );
    }

    if (!designName) {
      return NextResponse.json<PutResp>({ error: "Design Name is required." }, { status: 400 });
    }

    if (!recutReason) {
      return NextResponse.json<PutResp>({ error: "Recut Reason is required." }, { status: 400 });
    }

    if (!Number.isInteger(detailNumber) || detailNumber < 0) {
      return NextResponse.json<PutResp>(
        { error: "Detail # must be a whole number." },
        { status: 400 }
      );
    }

    if (!capStyle) {
      return NextResponse.json<PutResp>({ error: "Cap Style is required." }, { status: 400 });
    }

    if (!Number.isInteger(pieces) || pieces <= 0) {
      return NextResponse.json<PutResp>(
        { error: "Pieces must be greater than 0." },
        { status: 400 }
      );
    }

    if (!deliverTo) {
      return NextResponse.json<PutResp>({ error: "Deliver To is required." }, { status: 400 });
    }

    const authDept = normalizeDept((auth as any).department ?? null);
    if (isEmbDept(authDept)) {
      operator = String((auth as any).displayName ?? (auth as any).username ?? "").trim();
    }

    if (!operator) {
      return NextResponse.json<PutResp>({ error: "Operator is required." }, { status: 400 });
    }

    const nextValues = {
      requestedDepartment,
      salesOrder: normalizedSO.salesOrderDisplay,
      designName,
      recutReason,
      detailNumber,
      capStyle,
      pieces,
      operator,
      deliverTo,
      notes,
      event,
      supervisorApproved: !!current.supervisorApproved,
      warehousePrinted: !!current.warehousePrinted,
      doNotPull: !!current.doNotPull,
    };

    const changes = buildChanges(current, nextValues);
    const authName = String(
      (auth as any).displayName ?? (auth as any).username ?? "Unknown"
    ).trim();
    const userId = (auth as any).userId != null ? String((auth as any).userId) : null;
    const employeeNumber =
      (auth as any).employeeNumber != null ? Number((auth as any).employeeNumber) : null;
    const salesOrderNum = parseSalesOrderNumber(normalizedSO.salesOrderDisplay);

    await updateRecutRequest({
      id,
      requestedDepartment,
      salesOrder: normalizedSO.salesOrderDisplay,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      designName,
      recutReason,
      detailNumber,
      capStyle,
      pieces,
      operator,
      deliverTo,
      notes,
      event,

      supervisorApproved: !!current.supervisorApproved,
      supervisorApprovedAt: current.supervisorApprovedAt ? new Date(current.supervisorApprovedAt) : null,
      supervisorApprovedBy: current.supervisorApprovedBy,

      warehousePrinted: !!current.warehousePrinted,
      warehousePrintedAt: current.warehousePrintedAt ? new Date(current.warehousePrintedAt) : null,
      warehousePrintedBy: current.warehousePrintedBy,

      doNotPull: !!current.doNotPull,
      doNotPullAt: current.doNotPullAt ? new Date(current.doNotPullAt) : null,
      doNotPullBy: current.doNotPullBy,
    });

    const reloaded = await getRecutRequestById(id);
    if (!reloaded) {
      return NextResponse.json<PutResp>(
        { error: "Recut request is no longer available." },
        { status: 409 }
      );
    }

    await logAuditEvent({
      req,
      auth,
      module: "RECUT",
      eventType: "RECUT_UPDATED",
      message: "Recut request updated",
      recordType: "recut_requests",
      recordId: id,
      details: {
        recutId: current.recutId,
        changedFields: changes.map((x) => x.fieldName),
        changeCount: changes.length,
        salesOrder: normalizedSO.salesOrderDisplay,
        salesOrderBase: normalizedSO.salesOrderBase,
        detailNumber,
      },
    });

    await createActivityHistory({
      entityType: "recut_requests",
      entityId: id,
      eventType: "UPDATED",
      message: changes.length
        ? `Recut request updated (${changes.length} field${changes.length === 1 ? "" : "s"} changed)`
        : "Recut request updated",
      module: "RECUT",
      userId,
      userName: authName,
      employeeNumber,
      salesOrder: salesOrderNum,
      detailNumber,
    });

    for (const change of changes) {
      await createActivityHistory({
        entityType: "recut_requests",
        entityId: id,
        eventType: "FIELD_CHANGED",
        fieldName: change.fieldName,
        previousValue: change.previousValue,
        newValue: change.newValue,
        message: `${change.label} updated`,
        module: "RECUT",
        userId,
        userName: authName,
        employeeNumber,
        salesOrder: salesOrderNum,
        detailNumber,
      });
    }

    return NextResponse.json<PutResp>({ ok: true }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_UPDATE_ERROR",
      message: "Failed to update recut request",
      recordType: "recut_requests",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut PUT error:", err);
    return NextResponse.json<PutResp>({ error: "Server error" }, { status: 500 });
  }
}