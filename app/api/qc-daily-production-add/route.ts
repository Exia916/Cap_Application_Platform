import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createQCSubmission, addQCLinesBulk } from "@/lib/repositories/qcRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { normalizeSalesOrder, toLegacySalesOrderNumber } from "@/lib/utils/salesOrder";

type LineBody = {
  detailNumber: string;
  flatOr3d: string;
  orderQuantity: string;
  inspectedQuantity: string;
  rejectedQuantity: string;
  quantityShipped: string;
  notes?: string | null;
};

type Body = {
  entryTs: string;
  salesOrder?: string | null;
  notes?: string | null;
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

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const authAny = auth as any;
    const name = authAny.displayName ?? authAny.username ?? "";
    const employeeNumber = Number(authAny.employeeNumber);

    if (!name) throw new Error("Authenticated user name not found.");
    if (!Number.isFinite(employeeNumber)) throw new Error("Authenticated employeeNumber not found.");

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
    const headerNotes = body.notes?.toString().trim() || null;

    const sub = await createQCSubmission({
      entryTs,
      name,
      employeeNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      legacySalesOrder,
      notes: headerNotes,
    });

    const inserted = await addQCLinesBulk({
      submissionId: sub.id,
      entryTs,
      name,
      employeeNumber,
      salesOrderBase: normalizedSO.salesOrderBase,
      salesOrderDisplay: normalizedSO.salesOrderDisplay,
      legacySalesOrder,
      lines: body.lines.map((l, i) => {
        const detailNumber = toNullableInt(l.detailNumber);
        if (detailNumber === null) {
          throw new Error(`Line ${i + 1}: detailNumber is required (number).`);
        }

        return {
          detailNumber,
          flatOr3d: normalizeFlatOr3d(l.flatOr3d),
          orderQuantity: toNonNegIntOrNull(l.orderQuantity, `Line ${i + 1}: orderQuantity`),
          inspectedQuantity: toNonNegIntOrNull(l.inspectedQuantity, `Line ${i + 1}: inspectedQuantity`),
          rejectedQuantity: toNonNegIntOrNull(l.rejectedQuantity, `Line ${i + 1}: rejectedQuantity`),
          quantityShipped: toNonNegIntOrNull(l.quantityShipped, `Line ${i + 1}: quantityShipped`),
          notes: l.notes?.toString().trim() || null,
        };
      }),
    });

    await createActivityHistory({
      entityType: "qc_daily_submissions",
      entityId: sub.id,
      eventType: "CREATED",
      message: `QC submission created with ${inserted.ids.length} line(s).`,
      module: "QC",
      userId: authAny.userId != null ? String(authAny.userId) : null,
      userName: name,
      employeeNumber,
      salesOrder: parseSalesOrderNumber(
        normalizedSO.salesOrderDisplay ?? normalizedSO.salesOrderBase
      ),
      newValue: {
        salesOrder: normalizedSO.salesOrderDisplay ?? normalizedSO.salesOrderBase,
        lineCount: inserted.ids.length,
      },
    });

    return NextResponse.json({
      success: true,
      submissionId: sub.id,
      count: inserted.ids.length,
      ids: inserted.ids,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to add QC submission." },
      { status: 400 }
    );
  }
}