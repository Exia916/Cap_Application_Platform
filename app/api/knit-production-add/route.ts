import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createKnitProductionSubmission,
  knitAreaExists,
  type KnitProductionLineInput,
} from "@/lib/repositories/knitProductionRepo";
import { validateSessionBelongsToUser } from "@/lib/repositories/productionWorkSessionRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type PostBody = {
  entryTs?: string;
  stockOrder?: boolean;
  salesOrder?: string | null;
  knitArea?: string | null;
  sessionId?: string | null;
  notes?: string | null;
  lines?: Array<{
    detailNumber?: string | number | null;
    itemStyle?: string | null;
    logo?: string | null;
    quantity?: string | number | null;
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

function toRequiredTrimmed(value: unknown): string {
  return String(value ?? "").trim();
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

function parseLine(
  raw: NonNullable<PostBody["lines"]>[number]
): KnitProductionLineInput | null {
  const detailNumber = String(raw.detailNumber ?? "").trim();
  const itemStyle = String(raw.itemStyle ?? "").trim();
  const logo = String(raw.logo ?? "").trim();
  const quantity = String(raw.quantity ?? "").trim();
  const notes = String(raw.notes ?? "").trim();

  if (!detailNumber || !isWholeNumberString(detailNumber)) return null;
  if (!itemStyle) return null;
  if (!quantity || !isWholeNumberString(quantity)) return null;

  return {
    detailNumber: Number(detailNumber),
    itemStyle,
    logo: logo || null,
    quantity: Number(quantity),
    notes: notes || null,
  };
}

async function validateBody(body: any):
  Promise<
    | {
        ok: true;
        value: {
          entryTs: Date;
          stockOrder: boolean;
          salesOrderDisplay: string | null;
          salesOrderBase: string | null;
          knitArea: string;
          sessionId: string | null;
          notes: string | null;
          lines: KnitProductionLineInput[];
        };
      }
    | { ok: false; error: string }
  > {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const stockOrder = !!body.stockOrder;
  const salesOrderInput = toNullableTrimmed(body.salesOrder);
  const knitArea = toRequiredTrimmed(body.knitArea);
  const sessionId = toNullableTrimmed(body.sessionId);
  const notes = toNullableTrimmed(body.notes);
  const entryTs = body.entryTs ? new Date(body.entryTs) : new Date();

  if (Number.isNaN(entryTs.getTime())) {
    return { ok: false, error: "Invalid entry timestamp." };
  }

  if (!knitArea) {
    return { ok: false, error: "Knit Area is required." };
  }

  const knitAreaValid = await knitAreaExists(knitArea);
  if (!knitAreaValid) {
    return { ok: false, error: "Knit Area is invalid or inactive." };
  }

  const so = parseSalesOrderBase(salesOrderInput);

  if (!so.salesOrderDisplay) {
    return {
      ok: false,
      error: "Sales Order is required.",
    };
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0) {
    return { ok: false, error: "At least one line is required." };
  }

  const lines = rawLines.map(parseLine);
  if (lines.some((x: KnitProductionLineInput | null) => !x)) {
    return {
      ok: false,
      error:
        "One or more lines are invalid. Detail #, Item Style, and Quantity are required.",
    };
  }

  return {
    ok: true,
    value: {
      entryTs,
      stockOrder,
      salesOrderDisplay: so.salesOrderDisplay,
      salesOrderBase: so.salesOrderBase,
      knitArea,
      sessionId,
      notes,
      lines: lines as KnitProductionLineInput[],
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
        module: "KNIT_PRODUCTION",
        eventType: "KNIT_PRODUCTION_CREATE_FORBIDDEN",
        message: "User attempted to create knit production submission without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json<Resp>({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = await validateBody(body);
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

    if (validated.value.sessionId) {
      const session = await validateSessionBelongsToUser({
        sessionId: validated.value.sessionId,
        moduleKey: "knit_production",
        employeeNumber,
        requireOpen: true,
      });

      if (!session) {
        return NextResponse.json<Resp>(
          { error: "Session is invalid, closed, or does not belong to the current user." },
          { status: 400 }
        );
      }
    }

    const result = await createKnitProductionSubmission({
      entryTs: validated.value.entryTs,
      name: authName,
      employeeNumber,
      stockOrder: validated.value.stockOrder,
      salesOrderDisplay: validated.value.salesOrderDisplay,
      knitArea: validated.value.knitArea,
      sessionId: validated.value.sessionId,
      notes: validated.value.notes,
      lines: validated.value.lines,
    });

    createdId = result.id;

    const userId = auth.userId != null ? String(auth.userId) : null;
    const salesOrderNum = parseSalesOrderNumber(validated.value.salesOrderDisplay);

    await logAuditEvent({
      req,
      auth,
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_PRODUCTION_CREATED",
      message: "Knit production submission created",
      recordType: "knit_production_submissions",
      recordId: result.id,
      details: {
        stockOrder: validated.value.stockOrder,
        salesOrder: validated.value.salesOrderDisplay,
        salesOrderBase: validated.value.salesOrderBase,
        knitArea: validated.value.knitArea,
        sessionId: validated.value.sessionId,
        lineCount: validated.value.lines.length,
      },
    });

    await createActivityHistory({
      entityType: "knit_production_submissions",
      entityId: result.id,
      eventType: "CREATED",
      message: "Knit production submission created",
      module: "KNIT_PRODUCTION",
      userId,
      userName: authName,
      employeeNumber,
      salesOrder: salesOrderNum,
    });

    await createActivityHistory({
      entityType: "knit_production_submissions",
      entityId: result.id,
      eventType: "FIELD_CHANGED",
      fieldName: "knitArea",
      newValue: validated.value.knitArea,
      message: "Knit Area set",
      module: "KNIT_PRODUCTION",
      userId,
      userName: authName,
      employeeNumber,
      salesOrder: salesOrderNum,
    });

    await createActivityHistory({
      entityType: "knit_production_submissions",
      entityId: result.id,
      eventType: "LINES_ADDED",
      message: `${validated.value.lines.length} knit production line${
        validated.value.lines.length === 1 ? "" : "s"
      } added`,
      newValue: validated.value.lines,
      module: "KNIT_PRODUCTION",
      userId,
      userName: authName,
      employeeNumber,
      salesOrder: salesOrderNum,
    });

    return NextResponse.json<Resp>(
      { success: true, id: result.id, count: validated.value.lines.length },
      { status: 200 }
    );
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_PRODUCTION_CREATE_ERROR",
      message: "Failed to create knit production submission",
      recordType: "knit_production_submissions",
      recordId: createdId,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-production-add POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}