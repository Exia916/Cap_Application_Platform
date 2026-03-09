import { NextResponse } from "next/server";
import { addEmbroideryEntriesBulk, createEmbroiderySubmission } from "@/lib/repositories/embroideryRepo";
import { getAuthFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type LineBody = {
  detailNumber: string;
  embroideryLocation: string;
  stitches: string;
  pieces: string;

  // ✅ only used when Annex is true
  jobberSamplesRan?: string | null;

  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;
  notes?: string | null;
};

type Body = {
  entryTs: string;
  salesOrder?: string | null;
  machineNumber?: string | null;
  notes?: string | null; // header notes

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

function toNonNegIntOrNull(value: unknown, fieldLabel: string): number | null {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${fieldLabel} must be a non-negative integer.`);
  }
  return n;
}

function toNonNegIntRequired(value: unknown, fieldLabel: string): number {
  const n = toNonNegIntOrNull(value, fieldLabel);
  if (n === null) throw new Error(`${fieldLabel} is required.`);
  return n;
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const name = auth.displayName ?? auth.username ?? "";
    const employeeNumber = Number(auth.employeeNumber);
    const shift = auth.shift ?? "";

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

    const machineNumber = toNullableInt(body.machineNumber);
    const salesOrder = toNullableInt(body.salesOrder);
    const headerNotes = body.notes?.toString().trim() || null;

    const annex = !!body.annex;

    const lines = body.lines.map((line, idx) => {
      const detailNumber = toNullableInt(line.detailNumber);
      const embroideryLocation = (line.embroideryLocation ?? "").toString().trim();

      if (detailNumber === null) throw new Error(`Line ${idx + 1}: detailNumber is required (number).`);
      if (!embroideryLocation) throw new Error(`Line ${idx + 1}: embroideryLocation is required.`);

      return {
        detailNumber,
        embroideryLocation,
        stitches: toNonNegIntOrNull(line.stitches, `Line ${idx + 1}: stitches`),
        pieces: toNonNegIntOrNull(line.pieces, `Line ${idx + 1}: pieces`),

        // ✅ Required only when annex is true
        jobberSamplesRan: annex
          ? toNonNegIntRequired(line.jobberSamplesRan, `Line ${idx + 1}: Jobber Samples Ran`)
          : null,

        is3d: !!line.is3d,
        isKnit: !!line.isKnit,
        detailComplete: !!line.detailComplete,
        notes: line.notes?.toString().trim() || null,
      };
    });

    const submission = await createEmbroiderySubmission({
      entryTs,
      name,
      employeeNumber,
      shift,
      machineNumber,
      salesOrder,
      annex,
      notes: headerNotes,
    });

    const inserted = await addEmbroideryEntriesBulk({
      submissionId: submission.id,
      entryTs,
      name,
      employeeNumber,
      shift,
      machineNumber,
      salesOrder,
      annex,
      lines,
    });

    return NextResponse.json({
      success: true,
      count: inserted.length,
      ids: inserted.map((r) => r.id),
      submissionId: submission.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to add daily production entry." }, { status: 400 });
  }
}