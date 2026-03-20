import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createKnitQcSubmission,
  type KnitQcLineInput,
} from "@/lib/repositories/knitQcRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type PostBody = {
  entryTs?: string;
  stockOrder?: boolean;
  salesOrder?: string | null;
  notes?: string | null;
  lines?: Array<{
    detailNumber?: string | number | null;
    logo?: string | null;
    orderQuantity?: string | number | null;
    inspectedQuantity?: string | number | null;
    rejectedQuantity?: string | number | null;
    rejectReasonId?: string | null;
    qcEmployeeNumber?: string | number | null;
    notes?: string | null;
  }>;
};

type Resp =
  | { success: true; id: string; count: number }
  | { error: string };

const CREATE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

function isWholeNumberString(v: unknown) {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s);
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

function parseLine(raw: NonNullable<PostBody["lines"]>[number]): KnitQcLineInput | null {
  const detailNumber = String(raw.detailNumber ?? "").trim();
  const logo = String(raw.logo ?? "").trim();
  const orderQuantity = String(raw.orderQuantity ?? "").trim();
  const inspectedQuantity = String(raw.inspectedQuantity ?? "").trim();
  const rejectedQuantityParsed = parseOptionalWholeNumber(raw.rejectedQuantity);
  const rejectReasonId = String(raw.rejectReasonId ?? "").trim();
  const qcEmployeeNumberParsed = parseOptionalWholeNumber(raw.qcEmployeeNumber);
  const notes = String(raw.notes ?? "").trim();

  if (!detailNumber || !isWholeNumberString(detailNumber)) return null;
  if (!orderQuantity || !isWholeNumberString(orderQuantity)) return null;
  if (!inspectedQuantity || !isWholeNumberString(inspectedQuantity)) return null;
  if (rejectedQuantityParsed === "__invalid__") return null;
  if (qcEmployeeNumberParsed === "__invalid__") return null;

  return {
    detailNumber: Number(detailNumber),
    logo: logo || null,
    orderQuantity: Number(orderQuantity),
    inspectedQuantity: Number(inspectedQuantity),
    rejectedQuantity: rejectedQuantityParsed,
    rejectReasonId: rejectReasonId || null,
    qcEmployeeNumber: qcEmployeeNumberParsed,
    notes: notes || null,
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
        lines: KnitQcLineInput[];
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

  const lines = rawLines.map(parseLine);
  if (lines.some((x: KnitQcLineInput | null) => !x)) {
    return {
      ok: false,
      error:
        "One or more lines are invalid. Detail #, Order Quantity, and Inspected Quantity are required. Rejected Quantity and Employee must be whole numbers when entered.",
    };
  }

  return {
    ok: true,
    value: {
      entryTs,
      stockOrder,
      salesOrderDisplay: so.salesOrderDisplay,
      salesOrderBase: so.salesOrderBase,
      notes,
      lines: lines as KnitQcLineInput[],
    },
  };
}

export async function POST(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;
  let createdId: string | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, CREATE_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_QC",
        eventType: "KNIT_QC_CREATE_FORBIDDEN",
        message: "User attempted to create knit QC submission without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json<Resp>({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = validateBody(body);
    if (!validated.ok) {
      return NextResponse.json<Resp>({ error: validated.error }, { status: 400 });
    }

    const authName = String(
      auth.displayName ?? auth.name ?? auth.username ?? "Unknown"
    ).trim();

    const employeeNumber =
      auth.employeeNumber != null ? Number(auth.employeeNumber) : null;

    if (employeeNumber == null || !Number.isFinite(employeeNumber)) {
      return NextResponse.json<Resp>(
        { error: "Missing employee number in auth payload." },
        { status: 400 }
      );
    }

    const result = await createKnitQcSubmission({
      entryTs: validated.value.entryTs,
      name: authName,
      employeeNumber,
      stockOrder: validated.value.stockOrder,
      salesOrderDisplay: validated.value.salesOrderDisplay,
      notes: validated.value.notes,
      lines: validated.value.lines,
    });

    createdId = result.id;

    const userId = auth.userId != null ? String(auth.userId) : null;
    const salesOrderNum = parseSalesOrderNumber(validated.value.salesOrderDisplay);

    // Do not fail the request if audit/history logging has an issue.
    try {
      await logAuditEvent({
        req,
        auth,
        module: "KNIT_QC",
        eventType: "KNIT_QC_CREATED",
        message: "Knit QC submission created",
        recordType: "knit_qc_submissions",
        recordId: result.id,
        details: {
          stockOrder: validated.value.stockOrder,
          salesOrder: validated.value.salesOrderDisplay,
          salesOrderBase: validated.value.salesOrderBase,
          lineCount: validated.value.lines.length,
        },
      });

      await createActivityHistory({
        entityType: "knit_qc_submissions",
        entityId: result.id,
        eventType: "CREATED",
        message: "Knit QC submission created",
        module: "KNIT_QC",
        userId,
        userName: authName,
        employeeNumber,
        salesOrder: salesOrderNum,
      });

      await createActivityHistory({
        entityType: "knit_qc_submissions",
        entityId: result.id,
        eventType: "LINES_ADDED",
        message: `${validated.value.lines.length} QC line${
          validated.value.lines.length === 1 ? "" : "s"
        } added`,
        newValue: validated.value.lines,
        module: "KNIT_QC",
        userId,
        userName: authName,
        employeeNumber,
        salesOrder: salesOrderNum,
      });
    } catch (postCreateErr: any) {
      console.error("knit-qc-add post-create logging error:", postCreateErr);

      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_QC",
        eventType: "KNIT_QC_CREATE_POST_LOGGING_WARNING",
        message: "Knit QC submission was created, but post-create logging failed",
        recordType: "knit_qc_submissions",
        recordId: result.id,
      });
    }

    return NextResponse.json<Resp>(
      { success: true, id: result.id, count: validated.value.lines.length },
      { status: 200 }
    );
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_QC",
      eventType: "KNIT_QC_CREATE_ERROR",
      message: "Failed to create knit QC submission",
      recordType: "knit_qc_submissions",
      recordId: createdId,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-qc-add POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}