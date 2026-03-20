import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getKnitQcSubmissionById,
  listKnitQcLinesBySubmissionId,
  replaceKnitQcSubmission,
  canUserEditOwnKnitQcSubmission,
  type KnitQcSubmission,
  type KnitQcLine,
  type KnitQcLineInput,
} from "@/lib/repositories/knitQcRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type GetResp =
  | {
      submission: KnitQcSubmission;
      lines: KnitQcLine[];
    }
  | { error: string };

type PutResp = { ok: true } | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);
const POWER_EDIT_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

function parseId(req: NextRequest): string {
  return String(req.nextUrl.searchParams.get("id") ?? "").trim();
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function toNullableTrimmed(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function parseSalesOrderBase(
  salesOrderDisplay: string | null
): { salesOrderDisplay: string | null; salesOrderBase: string | null } {
  const display = String(salesOrderDisplay ?? "").trim();
  if (!display) {
    return {
      salesOrderDisplay: null,
      salesOrderBase: null,
    };
  }

  const m = display.match(/^(\d{7})/);

  return {
    salesOrderDisplay: display,
    salesOrderBase: m ? m[1] : null,
  };
}

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalWholeNumber(value: unknown): number | null | "__invalid__" {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return "__invalid__";
  return Number(s);
}

type IncomingLine = {
  detailNumber: number;
  logo: string | null;
  orderQuantity: number;
  inspectedQuantity: number;
  rejectedQuantity: number | null;
  rejectReasonId: string | null;
  qcEmployeeNumber: number | null;
  notes: string | null;
};

type ChangeRow = {
  fieldName: string;
  label: string;
  previousValue: unknown;
  newValue: unknown;
};

function normalizeCurrentLines(lines: KnitQcLine[]) {
  return lines.map((l) => ({
    detailNumber: l.detailNumber,
    logo: l.logo ?? null,
    orderQuantity: l.orderQuantity ?? 0,
    inspectedQuantity: l.inspectedQuantity ?? 0,
    rejectedQuantity: l.rejectedQuantity ?? null,
    rejectReasonId: l.rejectReasonId ?? null,
    qcEmployeeNumber: l.qcEmployeeNumber ?? null,
    notes: l.notes ?? null,
  }));
}

function normalizeIncomingLines(lines: IncomingLine[]) {
  return lines.map((l) => ({
    detailNumber: l.detailNumber,
    logo: l.logo ?? null,
    orderQuantity: l.orderQuantity ?? 0,
    inspectedQuantity: l.inspectedQuantity ?? 0,
    rejectedQuantity: l.rejectedQuantity ?? null,
    rejectReasonId: l.rejectReasonId ?? null,
    qcEmployeeNumber: l.qcEmployeeNumber ?? null,
    notes: l.notes ?? null,
  }));
}

function buildChanges(
  current: KnitQcSubmission,
  currentLines: KnitQcLine[],
  incoming: {
    entryTs: string;
    stockOrder: boolean;
    salesOrderDisplay: string | null;
    salesOrderBase: string | null;
    notes: string | null;
    lines: IncomingLine[];
  }
): ChangeRow[] {
  const changes: ChangeRow[] = [];

  if (!same(current.entryTs, incoming.entryTs)) {
    changes.push({
      fieldName: "entryTs",
      label: "Entry Timestamp",
      previousValue: current.entryTs,
      newValue: incoming.entryTs,
    });
  }

  if (!same(current.stockOrder, incoming.stockOrder)) {
    changes.push({
      fieldName: "stockOrder",
      label: "Stock Order",
      previousValue: current.stockOrder,
      newValue: incoming.stockOrder,
    });
  }

  if (!same(current.salesOrderDisplay, incoming.salesOrderDisplay)) {
    changes.push({
      fieldName: "salesOrderDisplay",
      label: "Sales Order",
      previousValue: current.salesOrderDisplay,
      newValue: incoming.salesOrderDisplay,
    });
  }

  if (!same(current.salesOrderBase, incoming.salesOrderBase)) {
    changes.push({
      fieldName: "salesOrderBase",
      label: "Sales Order Base",
      previousValue: current.salesOrderBase,
      newValue: incoming.salesOrderBase,
    });
  }

  if (!same(current.notes, incoming.notes)) {
    changes.push({
      fieldName: "notes",
      label: "Notes",
      previousValue: current.notes,
      newValue: incoming.notes,
    });
  }

  const cur = normalizeCurrentLines(currentLines);
  const nxt = normalizeIncomingLines(incoming.lines);

  if (cur.length !== nxt.length) {
    changes.push({
      fieldName: "lines",
      label: "Lines",
      previousValue: cur.length,
      newValue: nxt.length,
    });
  } else {
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i];
      const b = nxt[i];
      if (!same(a, b)) {
        changes.push({
          fieldName: `lines[${i}]`,
          label: `Line ${i + 1}`,
          previousValue: a,
          newValue: b,
        });
      }
    }
  }

  return changes;
}

function parseIncomingLine(raw: any): IncomingLine | null {
  const detailNumber = Number(String(raw?.detailNumber ?? "").trim());
  const logo = toNullableTrimmed(raw?.logo);
  const orderQuantity = Number(String(raw?.orderQuantity ?? "").trim());
  const inspectedQuantity = Number(String(raw?.inspectedQuantity ?? "").trim());
  const rejectedQuantity = parseOptionalWholeNumber(raw?.rejectedQuantity);
  const rejectReasonId = toNullableTrimmed(raw?.rejectReasonId);
  const qcEmployeeNumber = parseOptionalWholeNumber(raw?.qcEmployeeNumber);
  const notes = toNullableTrimmed(raw?.notes);

  if (!Number.isFinite(detailNumber) || detailNumber < 0) return null;
  if (!Number.isFinite(orderQuantity) || orderQuantity < 0) return null;
  if (!Number.isFinite(inspectedQuantity) || inspectedQuantity < 0) return null;
  if (rejectedQuantity === "__invalid__") return null;
  if (qcEmployeeNumber === "__invalid__") return null;

  return {
    detailNumber,
    logo,
    orderQuantity,
    inspectedQuantity,
    rejectedQuantity,
    rejectReasonId,
    qcEmployeeNumber,
    notes,
  };
}

function validateBody(body: any):
  | {
      ok: true;
      value: {
        entryTs: Date;
        stockOrder: boolean;
        salesOrderDisplay: string | null;
        salesOrderBase: string | null;
        notes: string | null;
        lines: IncomingLine[];
      };
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const stockOrder = !!body.stockOrder;
  const salesOrderInput = toNullableTrimmed(body.salesOrder);
  const notes = toNullableTrimmed(body.notes);
  const entryTs = body.entryTs ? new Date(body.entryTs) : new Date();

  if (Number.isNaN(entryTs.getTime())) {
    return { ok: false, error: "Invalid entry timestamp." };
  }

  const so = parseSalesOrderBase(salesOrderInput);

  if (!stockOrder && !so.salesOrderDisplay) {
    return {
      ok: false,
      error: "Sales Order is required unless Stock Order is checked.",
    };
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0) {
    return { ok: false, error: "At least one line is required." };
  }

  const lines: IncomingLine[] = [];
  for (const rl of rawLines) {
    const p = parseIncomingLine(rl);
    if (!p) {
      return {
        ok: false,
        error:
          "One or more lines are invalid. Detail #, Order Quantity, and Inspected Quantity are required. Rejected Quantity and Employee must be whole numbers when entered.",
      };
    }
    lines.push(p);
  }

  return {
    ok: true,
    value: {
      entryTs,
      stockOrder,
      salesOrderDisplay: so.salesOrderDisplay,
      salesOrderBase: so.salesOrderBase,
      notes,
      lines,
    },
  };
}

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);
    if (!auth) {
      return NextResponse.json<GetResp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, VIEW_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_QC",
        eventType: "KNIT_QC_VIEW_FORBIDDEN",
        message: "User attempted to view knit QC submission without permission",
      });
      return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
    }

    id = parseId(req);
    if (!id) {
      return NextResponse.json<GetResp>({ error: "Invalid id" }, { status: 400 });
    }

    const includeVoided = req.nextUrl.searchParams.get("includeVoided") === "true";
    const submission = await getKnitQcSubmissionById(id, {
      includeVoided,
    });

    if (!submission) {
      return NextResponse.json<GetResp>({ error: "Not found" }, { status: 404 });
    }

    const role = String(auth.role || "").trim().toUpperCase();
    const isPowerUser = POWER_EDIT_ROLES.has(role);
    const authEmployeeNumber = auth.employeeNumber != null ? Number(auth.employeeNumber) : null;

    if (!isPowerUser && authEmployeeNumber !== Number(submission.employeeNumber)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_QC",
        eventType: "KNIT_QC_VIEW_OWNERSHIP_FORBIDDEN",
        message: "User attempted to view another user's knit QC submission",
        recordType: "knit_qc_submissions",
        recordId: id,
      });
      return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
    }

    const lines = await listKnitQcLinesBySubmissionId(id);
    return NextResponse.json<GetResp>({ submission, lines }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_QC",
      eventType: "KNIT_QC_VIEW_ERROR",
      message: "Failed to load knit QC submission",
      recordType: "knit_qc_submissions",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-qc-submission GET error:", err);
    return NextResponse.json<GetResp>({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);
    if (!auth) {
      return NextResponse.json<PutResp>({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String(auth.role || "").trim().toUpperCase();
    if (!roleOk(role, new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]))) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_QC",
        eventType: "KNIT_QC_UPDATE_FORBIDDEN",
        message: "User attempted to update knit QC submission without permission",
      });
      return NextResponse.json<PutResp>({ error: "Forbidden" }, { status: 403 });
    }

    id = parseId(req);
    if (!id) {
      return NextResponse.json<PutResp>({ error: "Invalid id" }, { status: 400 });
    }

    const current = await getKnitQcSubmissionById(id, { includeVoided: true });
    if (!current) {
      return NextResponse.json<PutResp>({ error: "Not found" }, { status: 404 });
    }

    if (current.isVoided) {
      return NextResponse.json<PutResp>(
        { error: "Voided submissions cannot be edited." },
        { status: 409 }
      );
    }

    const isPowerEditor = POWER_EDIT_ROLES.has(role);
    if (!isPowerEditor) {
      const employeeNumber = auth.employeeNumber != null ? Number(auth.employeeNumber) : null;
      if (!employeeNumber || !Number.isFinite(employeeNumber)) {
        return NextResponse.json<PutResp>(
          { error: "Missing employee number in auth payload." },
          { status: 400 }
        );
      }

      const canEditOwn = await canUserEditOwnKnitQcSubmission({ id, employeeNumber });
      if (!canEditOwn) {
        return NextResponse.json<PutResp>(
          { error: "You can only edit your own active knit QC submissions." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    const validated = validateBody(body);
    if (!validated.ok) {
      return NextResponse.json<PutResp>({ error: validated.error }, { status: 400 });
    }

    const currentLines = await listKnitQcLinesBySubmissionId(id);
    const changes = buildChanges(current, currentLines, {
      entryTs: validated.value.entryTs.toISOString(),
      stockOrder: validated.value.stockOrder,
      salesOrderDisplay: validated.value.salesOrderDisplay,
      salesOrderBase: validated.value.salesOrderBase,
      notes: validated.value.notes,
      lines: validated.value.lines,
    });

    await replaceKnitQcSubmission({
      id,
      entryTs: validated.value.entryTs,
      stockOrder: validated.value.stockOrder,
      salesOrderDisplay: validated.value.salesOrderDisplay,
      notes: validated.value.notes,
      lines: validated.value.lines.map((l) => ({
        detailNumber: l.detailNumber,
        logo: l.logo,
        orderQuantity: l.orderQuantity,
        inspectedQuantity: l.inspectedQuantity,
        rejectedQuantity: l.rejectedQuantity,
        rejectReasonId: l.rejectReasonId,
        qcEmployeeNumber: l.qcEmployeeNumber,
        notes: l.notes,
      })) as KnitQcLineInput[],
    });

    const authName = String(
      auth.displayName ?? auth.name ?? auth.username ?? "Unknown"
    ).trim();
    const userId = auth.userId != null ? String(auth.userId) : null;
    const employeeNumber = auth.employeeNumber != null ? Number(auth.employeeNumber) : null;
    const salesOrderNum = parseSalesOrderNumber(validated.value.salesOrderDisplay);

    await logAuditEvent({
      req,
      auth,
      module: "KNIT_QC",
      eventType: "KNIT_QC_UPDATED",
      message: "Knit QC submission updated",
      recordType: "knit_qc_submissions",
      recordId: id,
      details: {
        changedFields: changes.map((x) => x.fieldName),
        changeCount: changes.length,
        stockOrder: validated.value.stockOrder,
        salesOrder: validated.value.salesOrderDisplay,
        salesOrderBase: validated.value.salesOrderBase,
        lineCount: validated.value.lines.length,
      },
    });

    await createActivityHistory({
      entityType: "knit_qc_submissions",
      entityId: id,
      eventType: "UPDATED",
      message: changes.length
        ? `Knit QC submission updated (${changes.length} field${changes.length === 1 ? "" : "s"} changed)`
        : "Knit QC submission updated",
      module: "KNIT_QC",
      userId,
      userName: authName,
      employeeNumber,
      salesOrder: salesOrderNum,
    });

    for (const change of changes) {
      await createActivityHistory({
        entityType: "knit_qc_submissions",
        entityId: id,
        eventType: "FIELD_CHANGED",
        fieldName: change.fieldName,
        previousValue: change.previousValue,
        newValue: change.newValue,
        message: `${change.label} updated`,
        module: "KNIT_QC",
        userId,
        userName: authName,
        employeeNumber,
        salesOrder: salesOrderNum,
      });
    }

    return NextResponse.json<PutResp>({ ok: true }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_QC",
      eventType: "KNIT_QC_UPDATE_ERROR",
      message: "Failed to update knit QC submission",
      recordType: "knit_qc_submissions",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-qc-submission PUT error:", err);
    return NextResponse.json<PutResp>({ error: "Server error" }, { status: 500 });
  }
}