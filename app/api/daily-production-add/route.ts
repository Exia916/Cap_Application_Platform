import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createEmbroiderySubmission,
  addEmbroideryEntriesBulk,
} from "@/lib/repositories/embroideryRepo";
import {
  normalizeSalesOrder,
  toLegacySalesOrderNumber,
} from "@/lib/utils/salesOrder";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

type LineBody = {
  detailNumber: string;
  embroideryLocation: string;
  stitches: string;
  pieces: string;
  jobberSamplesRan?: string | null;
  is3d?: boolean;
  isKnit?: boolean;
  detailComplete?: boolean;
  notes?: string | null;
};

type Body = {
  entryTs: string;
  salesOrder?: string | null;
  machineNumber?: string | null;
  notes?: string | null;
  annex?: boolean;
  lines: LineBody[];
};

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

function authDisplayName(auth: any): string {
  return String(
    auth?.displayName ?? auth?.name ?? auth?.username ?? "Unknown"
  ).trim();
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const name = auth.displayName ?? auth.username ?? "";
    const employeeNumber = Number(auth.employeeNumber);
    const shift = String(auth.shift ?? "").trim();

    if (!name) throw new Error("Authenticated user name not found.");
    if (!Number.isFinite(employeeNumber)) throw new Error("Authenticated employeeNumber not found.");
    if (!shift) throw new Error("Authenticated shift not found.");

    const body = (await req.json()) as Body;

    if (!body?.entryTs) throw new Error("entryTs is required.");
    if (!Array.isArray(body?.lines) || body.lines.length === 0) {
      throw new Error("At least one line is required.");
    }

    const entryTs = new Date(body.entryTs);
    if (Number.isNaN(entryTs.getTime())) throw new Error("entryTs is invalid.");

    const normalizedSO = normalizeSalesOrder(body.salesOrder);
    if (!normalizedSO.isValid) {
      throw new Error(normalizedSO.error ?? "Invalid Sales Order.");
    }

    const legacySalesOrder = toLegacySalesOrderNumber(normalizedSO.salesOrderBase);
    const machineNumber = toNullableInt(body.machineNumber);
    const headerNotes = body.notes?.toString().trim() || null;
    const annex = !!body.annex;

    const sub = await createEmbroiderySubmission({
      entryTs,
      name,
      employeeNumber,
      shift,
      machineNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      legacySalesOrder,
      annex,
      notes: headerNotes,
    });

    const inserted = await addEmbroideryEntriesBulk({
      submissionId: sub.id,
      entryTs,
      name,
      employeeNumber,
      shift,
      machineNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      legacySalesOrder,
      annex,
      lines: body.lines.map((l, i) => {
        const detailNumber = toNullableInt(l.detailNumber);
        if (detailNumber === null) throw new Error(`Line ${i + 1}: detailNumber is required.`);

        const embroideryLocation = String(l.embroideryLocation ?? "").trim();
        if (!embroideryLocation) throw new Error(`Line ${i + 1}: embroideryLocation is required.`);

        return {
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
          notes: l.notes?.toString().trim() || null,
        };
      }),
    });

    try {
      await createActivityHistory({
        entityType: "embroidery_daily_submissions",
        entityId: sub.id,
        eventType: "CREATED",
        message: `Embroidery submission created with ${inserted.length} line(s).`,
        module: "Embroidery",
        userId: auth.userId != null ? String(auth.userId) : null,
        userName: authDisplayName(auth),
        employeeNumber,
        salesOrder: legacySalesOrder,
        newValue: {
          lineCount: inserted.length,
          salesOrder: normalizedSO.salesOrderDisplay ?? normalizedSO.salesOrderBase,
          machineNumber,
          annex,
        },
      });
    } catch (historyErr) {
      console.error("daily-production-add activity history error:", historyErr);
    }

    return NextResponse.json({
      success: true,
      submissionId: sub.id,
      count: inserted.length,
      ids: inserted.map((x) => x.id),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to add submission." },
      { status: 400 }
    );
  }
}