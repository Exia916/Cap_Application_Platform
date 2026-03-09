import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createRecutRequest } from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

type Resp =
  | { id: string; recutId: number }
  | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
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

function isValidSalesOrder(v: string) {
  return /^\d{7}\.\d{3}$/.test(String(v || "").trim());
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    if (!roleOk((auth as any).role)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json<Resp>({ error: "Invalid request body." }, { status: 400 });
    }

    const requestedDepartment = String((body as any).requestedDepartment ?? "").trim();
    const salesOrder = String((body as any).salesOrder ?? "").trim();
    const designName = String((body as any).designName ?? "").trim();
    const recutReason = String((body as any).recutReason ?? "").trim();
    const detailNumber = Number((body as any).detailNumber);
    const capStyle = String((body as any).capStyle ?? "").trim();
    const pieces = Number((body as any).pieces);
    let operator = String((body as any).operator ?? "").trim();
    const deliverTo = String((body as any).deliverTo ?? "").trim();

    const supervisorApproved = !!(body as any).supervisorApproved;
    const warehousePrinted = !!(body as any).warehousePrinted;

    if (!requestedDepartment) {
      return NextResponse.json<Resp>({ error: "Requested Department is required." }, { status: 400 });
    }
    if (!isValidSalesOrder(salesOrder)) {
      return NextResponse.json<Resp>({ error: "Sales Order must be in format 3023113.001" }, { status: 400 });
    }
    if (!designName) {
      return NextResponse.json<Resp>({ error: "Design Name is required." }, { status: 400 });
    }
    if (!recutReason) {
      return NextResponse.json<Resp>({ error: "Recut Reason is required." }, { status: 400 });
    }
    if (!Number.isInteger(detailNumber) || detailNumber < 0) {
      return NextResponse.json<Resp>({ error: "Detail # must be a whole number." }, { status: 400 });
    }
    if (!capStyle) {
      return NextResponse.json<Resp>({ error: "Cap Style is required." }, { status: 400 });
    }
    if (!Number.isInteger(pieces) || pieces <= 0) {
      return NextResponse.json<Resp>({ error: "Pieces must be greater than 0." }, { status: 400 });
    }
    if (!deliverTo) {
      return NextResponse.json<Resp>({ error: "Deliver To is required." }, { status: 400 });
    }

    const authRole = String((auth as any).role ?? "").trim().toUpperCase();
    const authDept = normalizeDept((auth as any).department ?? null);
    const authName = String((auth as any).displayName ?? (auth as any).username ?? "").trim();

    if (isEmbDept(authDept)) {
      operator = authName;
    }

    if (!operator) {
      return NextResponse.json<Resp>({ error: "Operator is required." }, { status: 400 });
    }

    const canSetFlags =
      authRole === "ADMIN" || authRole === "MANAGER" || authRole === "SUPERVISOR";

    const result = await createRecutRequest({
      requestedByUserId:
        (auth as any).userId != null ? String((auth as any).userId) : null,
      requestedByUsername:
        (auth as any).username != null ? String((auth as any).username) : null,
      requestedByName: authName,
      requestedByEmployeeNumber:
        (auth as any).employeeNumber != null
          ? Number((auth as any).employeeNumber)
          : (auth as any).userId != null
            ? Number((auth as any).userId)
            : null,

      requestedDepartment,
      salesOrder,
      designName,
      recutReason,
      detailNumber,
      capStyle,
      pieces,
      operator,
      deliverTo,

      supervisorApproved: canSetFlags ? supervisorApproved : false,
      supervisorApprovedAt: canSetFlags && supervisorApproved ? new Date() : null,
      supervisorApprovedBy: canSetFlags && supervisorApproved ? authName : null,

      warehousePrinted: canSetFlags ? warehousePrinted : false,
      warehousePrintedAt: canSetFlags && warehousePrinted ? new Date() : null,
      warehousePrintedBy: canSetFlags && warehousePrinted ? authName : null,
    });

    return NextResponse.json<Resp>(result, { status: 201 });
  } catch (err) {
    console.error("recut add POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}