import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getKnitProductionSubmissionById,
  listKnitProductionLinesBySubmissionId,
  replaceKnitProductionSubmission,
  canUserEditOwnKnitSubmission,
  knitAreaExists,
  type KnitProductionSubmission,
  type KnitProductionLine,
} from "@/lib/repositories/knitProductionRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type GetResp =
  | {
      submission: KnitProductionSubmission;
      lines: KnitProductionLine[];
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

function toRequiredTrimmed(value: unknown): string {
  return String(value ?? "").trim();
}

function parseSalesOrderBase(
  salesOrderDisplay: string | null,
  stockOrder: boolean
): { salesOrderDisplay: string | null; salesOrderBase: string | null } {
  if (stockOrder) {
    return {
      salesOrderDisplay: null,
      salesOrderBase: null,
    };
  }

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

type IncomingLine = {
  detailNumber: number;
  itemStyle: string;
  logo: string;
  quantity: number;
  notes: string | null;
};

type ChangeRow = {
  fieldName: string;
  label: string;
  previousValue: unknown;
  newValue: unknown;
};

function normalizeCurrentLines(lines: KnitProductionLine[]) {
  return lines.map((line) => ({
    detailNumber: line.detailNumber ?? null,
    itemStyle: line.itemStyle ?? "",
    logo: line.logo ?? "",
    quantity: line.quantity ?? 0,
    notes: line.notes ?? null,
  }));
}

function normalizeNextLines(lines: IncomingLine[]) {
  return lines.map((line) => ({
    detailNumber: line.detailNumber,
    itemStyle: line.itemStyle,
    logo: line.logo,
    quantity: line.quantity,
    notes: line.notes ?? null,
  }));
}

function buildChanges(
  current: KnitProductionSubmission,
  currentLines: KnitProductionLine[],
  next: {
    entryTs: string;
    stockOrder: boolean;
    salesOrderDisplay: string | null;
    salesOrderBase: string | null;
    knitArea: string;
    notes: string | null;
    lines: IncomingLine[];
  }
): ChangeRow[] {
  const candidates: ChangeRow[] = [
    {
      fieldName: "entryTs",
      label: "Entry Timestamp",
      previousValue: current.entryTs,
      newValue: next.entryTs,
    },
    {
      fieldName: "stockOrder",
      label: "Stock Order",
      previousValue: !!current.stockOrder,
      newValue: !!next.stockOrder,
    },
    {
      fieldName: "salesOrder",
      label: "Sales Order",
      previousValue: current.salesOrderDisplay ?? current.salesOrderBase ?? null,
      newValue: next.salesOrderDisplay ?? next.salesOrderBase ?? null,
    },
    {
      fieldName: "knitArea",
      label: "Knit Area",
      previousValue: current.knitArea ?? null,
      newValue: next.knitArea ?? null,
    },
    {
      fieldName: "notes",
      label: "Header Notes",
      previousValue: current.notes ?? null,
      newValue: next.notes ?? null,
    },
    {
      fieldName: "lines",
      label: "Line Details",
      previousValue: normalizeCurrentLines(currentLines),
      newValue: normalizeNextLines(next.lines),
    },
  ];

  return candidates.filter((x) => !same(x.previousValue, x.newValue));
}

async function validateBody(body: any): Promise<{
  ok: true;
  value: {
    entryTs: Date;
    stockOrder: boolean;
    salesOrderDisplay: string | null;
    salesOrderBase: string | null;
    knitArea: string;
    notes: string | null;
    lines: IncomingLine[];
  };
} | {
  ok: false;
  error: string;
}> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const entryTsRaw = String(body.entryTs ?? "").trim();
  const entryTs = new Date(entryTsRaw);

  if (!entryTsRaw || Number.isNaN(entryTs.getTime())) {
    return { ok: false, error: "A valid entry timestamp is required." };
  }

  const stockOrder = !!body.stockOrder;
  const salesOrderInput = toNullableTrimmed(body.salesOrder);
  const so = parseSalesOrderBase(salesOrderInput, stockOrder);
  const knitArea = toRequiredTrimmed(body.knitArea);

  if (!knitArea) {
    return { ok: false, error: "Knit Area is required." };
  }

  const knitAreaValid = await knitAreaExists(knitArea);
  if (!knitAreaValid) {
    return { ok: false, error: "Knit Area is invalid or inactive." };
  }

  if (!stockOrder && !so.salesOrderDisplay) {
    return { ok: false, error: "Sales Order is required unless Stock Order is checked." };
  }

  const notes = toNullableTrimmed(body.notes);

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return { ok: false, error: "At least one line is required." };
  }

  const lines: IncomingLine[] = [];

  for (let i = 0; i < body.lines.length; i++) {
    const raw = body.lines[i];

    if (!raw || typeof raw !== "object") {
      return { ok: false, error: `Line ${i + 1} is invalid.` };
    }

    const detailNumber = Number(raw.detailNumber);
    const itemStyle = String(raw.itemStyle ?? "").trim();
    const logo = String(raw.logo ?? "").trim();
    const quantity = Number(raw.quantity);
    const notes = toNullableTrimmed(raw.notes);

    if (!Number.isInteger(detailNumber) || detailNumber < 0) {
      return { ok: false, error: `Line ${i + 1}: Detail # must be a whole number.` };
    }

    if (!itemStyle) {
      return { ok: false, error: `Line ${i + 1}: Item Style is required.` };
    }

    if (!logo) {
      return { ok: false, error: `Line ${i + 1}: Logo is required.` };
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return { ok: false, error: `Line ${i + 1}: Quantity must be a whole number.` };
    }

    lines.push({
      detailNumber,
      itemStyle,
      logo,
      quantity,
      notes,
    });
  }

  return {
    ok: true,
    value: {
      entryTs,
      stockOrder,
      salesOrderDisplay: so.salesOrderDisplay,
      salesOrderBase: so.salesOrderBase,
      knitArea,
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
        module: "KNIT_PRODUCTION",
        eventType: "KNIT_PRODUCTION_VIEW_FORBIDDEN",
        message: "User attempted to view knit production submission without permission",
      });

      return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
    }

    id = parseId(req);
    if (!id) {
      return NextResponse.json<GetResp>({ error: "Invalid id" }, { status: 400 });
    }

    const role = String(auth.role ?? "").trim().toUpperCase();
    const isPowerUser = POWER_EDIT_ROLES.has(role);
    const includeVoided = isPowerUser && req.nextUrl.searchParams.get("includeVoided") === "true";

    const submission = await getKnitProductionSubmissionById(id, {
      includeVoided,
    });

    if (!submission) {
      return NextResponse.json<GetResp>({ error: "Not found" }, { status: 404 });
    }

    const authEmployeeNumber =
      auth.employeeNumber != null ? Number(auth.employeeNumber) : null;

    if (!isPowerUser && authEmployeeNumber !== Number(submission.employeeNumber)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_PRODUCTION",
        eventType: "KNIT_PRODUCTION_VIEW_OWNERSHIP_FORBIDDEN",
        message: "User attempted to view another user's knit production submission",
        recordType: "knit_production_submissions",
        recordId: id,
      });

      return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
    }

    const lines = await listKnitProductionLinesBySubmissionId(id);

    return NextResponse.json<GetResp>({ submission, lines }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_PRODUCTION_VIEW_ERROR",
      message: "Failed to load knit production submission",
      recordType: "knit_production_submissions",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-production-submission GET error:", err);
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
        module: "KNIT_PRODUCTION",
        eventType: "KNIT_PRODUCTION_UPDATE_FORBIDDEN",
        message: "User attempted to update knit production submission without permission",
      });

      return NextResponse.json<PutResp>({ error: "Forbidden" }, { status: 403 });
    }

    id = parseId(req);
    if (!id) {
      return NextResponse.json<PutResp>({ error: "Invalid id" }, { status: 400 });
    }

    const current = await getKnitProductionSubmissionById(id, { includeVoided: true });
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
      const employeeNumber =
        auth.employeeNumber != null
          ? Number(auth.employeeNumber)
          : null;

      if (!employeeNumber || !Number.isFinite(employeeNumber)) {
        return NextResponse.json<PutResp>(
          { error: "Missing employee number in auth payload." },
          { status: 400 }
        );
      }

      const canEditOwn = await canUserEditOwnKnitSubmission({
        id,
        employeeNumber,
      });

      if (!canEditOwn) {
        return NextResponse.json<PutResp>(
          { error: "You can only edit your own active knit production submissions." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    const validated = await validateBody(body);

    if (!validated.ok) {
      return NextResponse.json<PutResp>({ error: validated.error }, { status: 400 });
    }

    const currentLines = await listKnitProductionLinesBySubmissionId(id);

    const changes = buildChanges(current, currentLines, {
      entryTs: validated.value.entryTs.toISOString(),
      stockOrder: validated.value.stockOrder,
      salesOrderDisplay: validated.value.salesOrderDisplay,
      salesOrderBase: validated.value.salesOrderBase,
      knitArea: validated.value.knitArea,
      notes: validated.value.notes,
      lines: validated.value.lines,
    });

    await replaceKnitProductionSubmission({
      id,
      entryTs: validated.value.entryTs,
      stockOrder: validated.value.stockOrder,
      salesOrderDisplay: validated.value.salesOrderDisplay,
      knitArea: validated.value.knitArea,
      notes: validated.value.notes,
      lines: validated.value.lines,
    });

    const authName = String(
      auth.displayName ?? auth.name ?? auth.username ?? "Unknown"
    ).trim();

    const userId = auth.userId != null ? String(auth.userId) : null;
    const employeeNumber =
      auth.employeeNumber != null ? Number(auth.employeeNumber) : null;

    const salesOrderNum = parseSalesOrderNumber(validated.value.salesOrderDisplay);

    await logAuditEvent({
      req,
      auth,
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_PRODUCTION_UPDATED",
      message: "Knit production submission updated",
      recordType: "knit_production_submissions",
      recordId: id,
      details: {
        changedFields: changes.map((x) => x.fieldName),
        changeCount: changes.length,
        stockOrder: validated.value.stockOrder,
        salesOrder: validated.value.salesOrderDisplay,
        salesOrderBase: validated.value.salesOrderBase,
        knitArea: validated.value.knitArea,
        lineCount: validated.value.lines.length,
      },
    });

    await createActivityHistory({
      entityType: "knit_production_submissions",
      entityId: id,
      eventType: "UPDATED",
      message: changes.length
        ? `Knit production submission updated (${changes.length} field${changes.length === 1 ? "" : "s"} changed)`
        : "Knit production submission updated",
      module: "KNIT_PRODUCTION",
      userId,
      userName: authName,
      employeeNumber,
      salesOrder: salesOrderNum,
    });

    for (const change of changes) {
      await createActivityHistory({
        entityType: "knit_production_submissions",
        entityId: id,
        eventType: "FIELD_CHANGED",
        fieldName: change.fieldName,
        previousValue: change.previousValue,
        newValue: change.newValue,
        message: `${change.label} updated`,
        module: "KNIT_PRODUCTION",
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
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_PRODUCTION_UPDATE_ERROR",
      message: "Failed to update knit production submission",
      recordType: "knit_production_submissions",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-production-submission PUT error:", err);
    return NextResponse.json<PutResp>({ error: "Server error" }, { status: 500 });
  }
}