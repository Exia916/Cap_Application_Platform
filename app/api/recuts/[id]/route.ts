import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canUserEditOwnRecutRequest,
  getRecutRequestById,
  updateRecutRequest,
} from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

type Resp =
  | { entry: any }
  | { ok: true }
  | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER", "WAREHOUSE"]);
const EDIT_MANAGER_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    if (!roleOk((auth as any).role, VIEW_ROLES)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const entry = await getRecutRequestById(id);

    if (!entry) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    const authRole = String((auth as any).role ?? "").trim().toUpperCase();
    const employeeNumber =
      (auth as any).employeeNumber != null
        ? Number((auth as any).employeeNumber)
        : (auth as any).userId != null
          ? Number((auth as any).userId)
          : null;

    const isManager = EDIT_MANAGER_ROLES.has(authRole);
    const isOwner =
      employeeNumber != null &&
      Number(entry.requestedByEmployeeNumber ?? -1) === Number(employeeNumber);

    if (!isManager && !isOwner) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json<Resp>({ entry }, { status: 200 });
  } catch (err) {
    console.error("recut GET by id error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    if (!roleOk((auth as any).role, VIEW_ROLES)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const current = await getRecutRequestById(id);

    if (!current) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    const authRole = String((auth as any).role ?? "").trim().toUpperCase();
    const authName = String((auth as any).displayName ?? (auth as any).username ?? "").trim();
    const employeeNumber =
      (auth as any).employeeNumber != null
        ? Number((auth as any).employeeNumber)
        : (auth as any).userId != null
          ? Number((auth as any).userId)
          : null;

    const isManager = EDIT_MANAGER_ROLES.has(authRole);

    if (!isManager) {
      if (!employeeNumber || !Number.isFinite(employeeNumber)) {
        return NextResponse.json<Resp>({ error: "Missing employee number in auth payload." }, { status: 400 });
      }

      const canEdit = await canUserEditOwnRecutRequest({
        id,
        employeeNumber,
      });

      if (!canEdit) {
        return NextResponse.json<Resp>(
          { error: "This recut request can no longer be edited." },
          { status: 403 }
        );
      }
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

    let supervisorApproved = !!(body as any).supervisorApproved;
    let warehousePrinted = !!(body as any).warehousePrinted;

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

    const authDept = normalizeDept((auth as any).department ?? null);
    if (isEmbDept(authDept)) {
      operator = authName;
    }
    if (!operator) {
      return NextResponse.json<Resp>({ error: "Operator is required." }, { status: 400 });
    }

    if (!isManager) {
      supervisorApproved = current.supervisorApproved;
      warehousePrinted = current.warehousePrinted;
    }

    await updateRecutRequest({
      id,
      requestedDepartment,
      salesOrder,
      designName,
      recutReason,
      detailNumber,
      capStyle,
      pieces,
      operator,
      deliverTo,

      supervisorApproved,
      supervisorApprovedAt:
        supervisorApproved && !current.supervisorApproved
          ? new Date()
          : current.supervisorApprovedAt
            ? new Date(current.supervisorApprovedAt)
            : null,
      supervisorApprovedBy:
        supervisorApproved && !current.supervisorApproved
          ? authName
          : current.supervisorApprovedBy,

      warehousePrinted,
      warehousePrintedAt:
        warehousePrinted && !current.warehousePrinted
          ? new Date()
          : current.warehousePrintedAt
            ? new Date(current.warehousePrintedAt)
            : null,
      warehousePrintedBy:
        warehousePrinted && !current.warehousePrinted
          ? authName
          : current.warehousePrintedBy,
    });

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("recut PUT by id error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}