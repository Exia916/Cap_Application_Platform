import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getEmbroiderySubmissionWithLines,
  replaceEmbroiderySubmission,
} from "@/lib/repositories/embroideryRepo";
import {
  normalizeSalesOrder,
  toLegacySalesOrderNumber,
} from "@/lib/utils/salesOrder";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

const ALL_ACCESS_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOf(auth: any): string {
  return String(auth?.role ?? "").trim().toUpperCase();
}

function canAccessAny(auth: any): boolean {
  return ALL_ACCESS_ROLES.has(roleOf(auth));
}

function canEditSubmission(auth: any, submission: any): boolean {
  return (
    roleOf(auth) === "ADMIN" ||
    Number(auth?.employeeNumber) === Number(submission?.employeeNumber)
  );
}

function authDisplayName(auth: any): string {
  return String(
    auth?.displayName ?? auth?.name ?? auth?.username ?? "Unknown"
  ).trim();
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
  embroideryLocation: string | null;
  stitches: number | null;
  pieces: number | null;
  jobberSamplesRan: number | null;
  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;
  notes: string | null;
};

type Change = {
  fieldName: string;
  message: string;
  previousValue: unknown;
  newValue: unknown;
  detailNumber?: number | null;
};

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;

  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function lineDisplayName(line: NormalizedLine) {
  return line.detailNumber != null
    ? `Line ${line.lineNumber} / Detail #${line.detailNumber}`
    : `Line ${line.lineNumber}`;
}

function buildEmbroideryUpdateChanges(input: {
  previousSubmission: any;
  previousLines: any[];
  nextSalesOrder: string | null;
  nextMachineNumber: number | null;
  nextAnnex: boolean;
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
      message: "Embroidery submission Sales Order changed",
      previousValue: previousSalesOrder,
      newValue: input.nextSalesOrder,
    });
  }

  if (!valuesEqual(input.previousSubmission.machineNumber, input.nextMachineNumber)) {
    changes.push({
      fieldName: "machineNumber",
      message: "Embroidery submission Machine changed",
      previousValue: input.previousSubmission.machineNumber ?? null,
      newValue: input.nextMachineNumber,
    });
  }

  if (!valuesEqual(!!input.previousSubmission.annex, input.nextAnnex)) {
    changes.push({
      fieldName: "annex",
      message: "Embroidery submission Annex changed",
      previousValue: !!input.previousSubmission.annex,
      newValue: input.nextAnnex,
    });
  }

  if (!valuesEqual(input.previousSubmission.notes, input.nextNotes)) {
    changes.push({
      fieldName: "notes",
      message: "Embroidery submission Header Notes changed",
      previousValue: input.previousSubmission.notes ?? null,
      newValue: input.nextNotes,
    });
  }

  const previousNormalizedLines: NormalizedLine[] = input.previousLines.map(
    (line, idx) => ({
      lineNumber: idx + 1,
      detailNumber:
        line.detailNumber == null ? null : Number(line.detailNumber),
      embroideryLocation: cleanText(line.embroideryLocation),
      stitches: line.stitches == null ? null : Number(line.stitches),
      pieces: line.pieces == null ? null : Number(line.pieces),
      jobberSamplesRan:
        line.jobberSamplesRan == null ? null : Number(line.jobberSamplesRan),
      is3d: !!line.is3d,
      isKnit: !!line.isKnit,
      detailComplete: !!line.detailComplete,
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
      { key: "embroideryLocation", label: "Location" },
      { key: "stitches", label: "Stitches" },
      { key: "pieces", label: "Pieces" },
      { key: "jobberSamplesRan", label: "Jobber Samples Ran" },
      { key: "is3d", label: "3D" },
      { key: "isKnit", label: "Knit" },
      { key: "detailComplete", label: "Detail Complete" },
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
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const includeVoided = req.nextUrl.searchParams.get("includeVoided") === "true";

  const result = await getEmbroiderySubmissionWithLines(id, {
    includeVoided,
  });

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { submission, lines } = result;

  const isOwnSubmission =
    Number(auth.employeeNumber) === Number(submission.employeeNumber);

  if (!canAccessAny(auth) && !isOwnSubmission) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ submission, lines }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const result = await getEmbroiderySubmissionWithLines(id, {
    includeVoided: true,
  });

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { submission, lines: previousLines } = result;

  if (submission.isVoided) {
    return NextResponse.json(
      { error: "Voided submissions cannot be edited." },
      { status: 409 }
    );
  }

  if (!canEditSubmission(auth, submission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const entryTs = new Date(body.entryTs ?? new Date().toISOString());
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const normalizedSO = normalizeSalesOrder(body.salesOrder);
    if (!normalizedSO.isValid) {
      throw new Error(normalizedSO.error ?? "Invalid Sales Order.");
    }

    const legacySalesOrder = toLegacySalesOrderNumber(normalizedSO.salesOrderBase);
    const machineNumber = toNullableInt(body.machineNumber);
    const headerNotes = cleanText(body.notes);
    const annex = !!body.annex;

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length === 0) throw new Error("At least one line is required.");

    const nextLines: NormalizedLine[] = rawLines.map((l: any, i: number) => {
      const detailNumber = toNullableInt(l.detailNumber);
      if (detailNumber === null) throw new Error(`Line ${i + 1}: detailNumber is required.`);

      const embroideryLocation = cleanText(l.embroideryLocation);
      if (!embroideryLocation) throw new Error(`Line ${i + 1}: embroideryLocation is required.`);

      return {
        lineNumber: i + 1,
        detailNumber,
        embroideryLocation,
        stitches: toNonNegIntOrNull(l.stitches, `Line ${i + 1}: stitches`),
        pieces: toNonNegIntOrNull(l.pieces, `Line ${i + 1}: pieces`),
        jobberSamplesRan: annex
          ? toNonNegIntOrNull(l.jobberSamplesRan, `Line ${i + 1}: jobberSamplesRan`)
          : null,
        is3d: !!l.is3d,
        isKnit: !!l.isKnit,
        detailComplete: !!l.detailComplete,
        notes: cleanText(l.notes),
      };
    });

    const nextSalesOrder =
      normalizedSO.salesOrderDisplay ?? normalizedSO.salesOrderBase ?? null;

    const changes = buildEmbroideryUpdateChanges({
      previousSubmission: submission,
      previousLines,
      nextSalesOrder,
      nextMachineNumber: machineNumber,
      nextAnnex: annex,
      nextNotes: headerNotes,
      nextLines,
    });

    const update = await replaceEmbroiderySubmission({
      submissionId: id,
      entryTs,
      machineNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      legacySalesOrder,
      annex,
      notes: headerNotes,
      lines: nextLines.map((line) => ({
        detailNumber: line.detailNumber,
        embroideryLocation: line.embroideryLocation,
        stitches: line.stitches,
        pieces: line.pieces,
        jobberSamplesRan: line.jobberSamplesRan,
        is3d: line.is3d,
        isKnit: line.isKnit,
        detailComplete: line.detailComplete,
        notes: line.notes,
      })),
    });

    const authName = authDisplayName(auth);
    const userId = auth.userId != null ? String(auth.userId) : null;
    const employeeNumber =
      auth.employeeNumber != null ? Number(auth.employeeNumber) : null;
    const salesOrderNumber = parseSalesOrderNumber(nextSalesOrder);

    if (changes.length > 0) {
      for (const change of changes) {
        await createActivityHistory({
          entityType: "embroidery_daily_submissions",
          entityId: id,
          eventType: "UPDATED",
          fieldName: change.fieldName,
          message: change.message,
          module: "Embroidery",
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
        entityType: "embroidery_daily_submissions",
        entityId: id,
        eventType: "UPDATED",
        message: `Embroidery submission saved with ${update.count} line(s). No field-level changes detected.`,
        module: "Embroidery",
        userId,
        userName: authName,
        employeeNumber,
        salesOrder: salesOrderNumber,
        newValue: {
          salesOrder: nextSalesOrder,
          lineCount: update.count,
        },
      });
    }

    return NextResponse.json(
      { success: true, count: update.count, changeCount: changes.length },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to update submission." },
      { status: 400 }
    );
  }
}