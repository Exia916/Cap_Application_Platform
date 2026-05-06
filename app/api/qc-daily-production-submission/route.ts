import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getQCSubmissionWithLines,
  replaceQCSubmission,
} from "@/lib/repositories/qcRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import {
  normalizeSalesOrder,
  toLegacySalesOrderNumber,
} from "@/lib/utils/salesOrder";

const QC_ACCESS_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function canAccessAnyQc(role: string | null | undefined) {
  return QC_ACCESS_ROLES.has(String(role || "").trim().toUpperCase());
}

function toNullableInt(value: unknown): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function toNonNegIntOrNull(value: unknown, label: string): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return n;
}

function normalizeFlatOr3d(v: unknown): "FLAT" | "3D" | null {
  const s = (v ?? "").toString().trim().toUpperCase();
  if (!s) return null;
  if (s === "FLAT") return "FLAT";
  if (s === "3D") return "3D";
  throw new Error("Flat Or 3D must be FLAT or 3D.");
}

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;

  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  const aa = a === undefined ? null : a;
  const bb = b === undefined ? null : b;
  return String(aa ?? "") === String(bb ?? "");
}

type NormalizedLine = {
  lineNumber: number;
  detailNumber: number | null;
  flatOr3d: "FLAT" | "3D" | null;
  orderQuantity: number | null;
  inspectedQuantity: number | null;
  rejectedQuantity: number | null;
  quantityShipped: number | null;
  notes: string | null;
};

type Change = {
  fieldName: string;
  message: string;
  previousValue: unknown;
  newValue: unknown;
  detailNumber?: number | null;
};

function lineDisplayName(line: NormalizedLine) {
  return line.detailNumber != null
    ? `Line ${line.lineNumber} / Detail #${line.detailNumber}`
    : `Line ${line.lineNumber}`;
}

function buildQcUpdateChanges(input: {
  previousSubmission: any;
  previousLines: any[];
  nextSalesOrder: string | null;
  nextNotes: string | null;
  nextLines: NormalizedLine[];
}): Change[] {
  const changes: Change[] = [];

  const previousSalesOrder =
    input.previousSubmission.salesOrderDisplay ??
    input.previousSubmission.salesOrderBase ??
    input.previousSubmission.salesOrder ??
    null;

  if (!valuesEqual(previousSalesOrder, input.nextSalesOrder)) {
    changes.push({
      fieldName: "salesOrder",
      message: "QC submission Sales Order changed",
      previousValue: previousSalesOrder,
      newValue: input.nextSalesOrder,
    });
  }

  if (!valuesEqual(input.previousSubmission.notes, input.nextNotes)) {
    changes.push({
      fieldName: "notes",
      message: "QC submission Header Notes changed",
      previousValue: input.previousSubmission.notes ?? null,
      newValue: input.nextNotes,
    });
  }

  const previousNormalizedLines: NormalizedLine[] = input.previousLines.map(
    (line, idx) => ({
      lineNumber: idx + 1,
      detailNumber:
        line.detailNumber == null ? null : Number(line.detailNumber),
      flatOr3d:
        line.flatOr3d == null
          ? null
          : normalizeFlatOr3d(line.flatOr3d),
      orderQuantity:
        line.orderQuantity == null ? null : Number(line.orderQuantity),
      inspectedQuantity:
        line.inspectedQuantity == null ? null : Number(line.inspectedQuantity),
      rejectedQuantity:
        line.rejectedQuantity == null ? null : Number(line.rejectedQuantity),
      quantityShipped:
        line.quantityShipped == null ? null : Number(line.quantityShipped),
      notes: cleanText(line.notes),
    })
  );

  const maxLines = Math.max(
    previousNormalizedLines.length,
    input.nextLines.length
  );

  for (let i = 0; i < maxLines; i++) {
    const previousLine = previousNormalizedLines[i] ?? null;
    const nextLine = input.nextLines[i] ?? null;

    if (!previousLine && nextLine) {
      changes.push({
        fieldName: `line.${i + 1}`,
        message: `${lineDisplayName(nextLine)} added`,
        previousValue: null,
        newValue: nextLine,
        detailNumber: nextLine.detailNumber,
      });
      continue;
    }

    if (previousLine && !nextLine) {
      changes.push({
        fieldName: `line.${i + 1}`,
        message: `${lineDisplayName(previousLine)} removed`,
        previousValue: previousLine,
        newValue: null,
        detailNumber: previousLine.detailNumber,
      });
      continue;
    }

    if (!previousLine || !nextLine) continue;

    const lineLabel = lineDisplayName(nextLine);

    const lineFields: Array<{
      key: keyof NormalizedLine;
      label: string;
    }> = [
      { key: "detailNumber", label: "Detail #" },
      { key: "flatOr3d", label: "Flat / 3D" },
      { key: "orderQuantity", label: "Order Qty" },
      { key: "inspectedQuantity", label: "Inspected Qty" },
      { key: "rejectedQuantity", label: "Rejected Qty" },
      { key: "quantityShipped", label: "Qty Shipped" },
      { key: "notes", label: "Line Notes" },
    ];

    for (const field of lineFields) {
      const previousValue = previousLine[field.key];
      const newValue = nextLine[field.key];

      if (!valuesEqual(previousValue, newValue)) {
        changes.push({
          fieldName: `line.${i + 1}.${String(field.key)}`,
          message: `${lineLabel} ${field.label} changed`,
          previousValue,
          newValue,
          detailNumber: nextLine.detailNumber ?? previousLine.detailNumber,
        });
      }
    }
  }

  return changes;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authAny = auth as any;

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const includeVoided =
    req.nextUrl.searchParams.get("includeVoided") === "true";

  const { submission, lines } = await getQCSubmissionWithLines(id, {
    includeVoided,
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canAccessAny = canAccessAnyQc(authAny.role);
  const isOwnSubmission =
    Number(authAny.employeeNumber) === Number(submission.employeeNumber);

  if (!canAccessAny && !isOwnSubmission) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ submission, lines }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authAny = auth as any;

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const current = await getQCSubmissionWithLines(id, {
    includeVoided: true,
  });

  const { submission, lines: previousLines } = current;

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (submission.isVoided) {
    return NextResponse.json(
      { error: "Voided submissions cannot be edited." },
      { status: 409 }
    );
  }

  // Keep edit permission restricted to ADMIN or the original owner.
  if (
    authAny.role !== "ADMIN" &&
    Number(authAny.employeeNumber) !== Number(submission.employeeNumber)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const entryTs = new Date(body.entryTs ?? new Date().toISOString());
    if (Number.isNaN(entryTs.getTime())) {
      throw new Error("entryTs is invalid.");
    }

    const normalizedSO = normalizeSalesOrder(body.salesOrder);
    if (!normalizedSO.isValid) {
      throw new Error(normalizedSO.error ?? "Invalid Sales Order.");
    }

    const legacySalesOrder = toLegacySalesOrderNumber(
      normalizedSO.salesOrderBase
    );
    const headerNotes = cleanText(body.notes);

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length === 0) {
      throw new Error("At least one line is required.");
    }

    const nextLines: NormalizedLine[] = rawLines.map((l: any, i: number) => {
      const detailNumber = toNullableInt(l.detailNumber);
      if (detailNumber === null) {
        throw new Error(`Line ${i + 1}: detailNumber is required (number).`);
      }

      return {
        lineNumber: i + 1,
        detailNumber,
        flatOr3d: normalizeFlatOr3d(l.flatOr3d),
        orderQuantity: toNonNegIntOrNull(
          l.orderQuantity,
          `Line ${i + 1}: orderQuantity`
        ),
        inspectedQuantity: toNonNegIntOrNull(
          l.inspectedQuantity,
          `Line ${i + 1}: inspectedQuantity`
        ),
        rejectedQuantity: toNonNegIntOrNull(
          l.rejectedQuantity,
          `Line ${i + 1}: rejectedQuantity`
        ),
        quantityShipped: toNonNegIntOrNull(
          l.quantityShipped,
          `Line ${i + 1}: quantityShipped`
        ),
        notes: cleanText(l.notes),
      };
    });

    const nextSalesOrder =
      normalizedSO.salesOrderDisplay ?? normalizedSO.salesOrderBase ?? null;

    const changes = buildQcUpdateChanges({
      previousSubmission: submission,
      previousLines,
      nextSalesOrder,
      nextNotes: headerNotes,
      nextLines,
    });

    const result = await replaceQCSubmission({
      submissionId: id,
      entryTs,
      name: submission.name,
      employeeNumber: submission.employeeNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      legacySalesOrder,
      notes: headerNotes,
      lines: nextLines.map((line) => ({
        detailNumber: line.detailNumber,
        flatOr3d: line.flatOr3d,
        orderQuantity: line.orderQuantity,
        inspectedQuantity: line.inspectedQuantity,
        rejectedQuantity: line.rejectedQuantity,
        quantityShipped: line.quantityShipped,
        notes: line.notes,
      })),
    });

    const authName = String(
      authAny.displayName ?? authAny.name ?? authAny.username ?? "Unknown"
    ).trim();

    const userId = authAny.userId != null ? String(authAny.userId) : null;
    const employeeNumber =
      authAny.employeeNumber != null ? Number(authAny.employeeNumber) : null;

    const salesOrderNumber = parseSalesOrderNumber(nextSalesOrder);

    if (changes.length > 0) {
      for (const change of changes) {
        await createActivityHistory({
          entityType: "qc_daily_submissions",
          entityId: id,
          eventType: "UPDATED",
          fieldName: change.fieldName,
          message: change.message,
          module: "QC",
          userId,
          userName: authName,
          employeeNumber,
          salesOrder: salesOrderNumber,
          detailNumber:
            change.detailNumber != null ? Number(change.detailNumber) : null,
          previousValue: change.previousValue,
          newValue: change.newValue,
        });
      }
    } else {
      await createActivityHistory({
        entityType: "qc_daily_submissions",
        entityId: id,
        eventType: "UPDATED",
        message: `QC submission saved with ${result.count} line(s). No field-level changes detected.`,
        module: "QC",
        userId,
        userName: authName,
        employeeNumber,
        salesOrder: salesOrderNumber,
        newValue: {
          salesOrder: nextSalesOrder,
          lineCount: result.count,
        },
      });
    }

    return NextResponse.json(
      { success: true, count: result.count, changeCount: changes.length },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update submission." },
      { status: 400 }
    );
  }
}