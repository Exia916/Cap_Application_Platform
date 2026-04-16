import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { changeStatus } from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

const STATUS_ROLES = [
  "ADMIN",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "OVERSEAS CUSTOMER SERVICE",
  "DIGITIZING",
  "ART",
  "ORDER PROCESSING",
];

function hasRole(userRole: string | null | undefined, roles: string[]) {
  return roles.includes(String(userRole ?? "").toUpperCase());
}

function mapRequestRow(row: any) {
  if (!row) return null;

  return {
    id: row.id,
    requestNumber: row.request_number ?? "",
    salesOrderNumber: row.sales_order_number ?? null,
    salesOrderBase: row.sales_order_base ?? null,
    salesOrderDisplay: row.sales_order_number ?? row.sales_order_base ?? null,
    poNumber: row.po_number ?? null,
    tapeName: row.tape_name ?? null,
    dateRequestCreated: row.date_request_created ?? null,
    dueDate: row.due_date ?? null,
    customerName: row.customer_name ?? null,
    customerCode: row.customer_code ?? null,
    binCode: row.bin_code ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    createdByName: row.created_by_name ?? null,
    digitizerUserId: row.digitizer_user_id ?? null,
    digitizerName: row.digitizer_name ?? null,
    designerUserId: row.designer_user_id ?? null,
    designerName: row.designer_name ?? null,
    statusId: row.status_id ?? null,
    statusCode: row.status_code ?? "",
    statusLabel: row.status_label ?? "",
    instructions: row.instructions ?? null,
    additionalInstructions: row.additional_instructions ?? null,
    colorwaysText: row.colorways_text ?? null,
    tapeNumber: row.tape_number ?? null,
    rush: !!row.rush,
    styleCode: row.style_code ?? null,
    sampleSoNumber: row.sample_so_number ?? null,
    stitchCount: row.stitch_count ?? null,
    artProof: !!row.art_proof,
    isVoided: !!row.is_voided,
    voidedAt: row.voided_at ?? null,
    voidedBy: row.voided_by ?? null,
    voidReason: row.void_reason ?? null,
    createdAt: row.created_at ?? null,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!hasRole(user.role, STATUS_ROLES)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const newStatusId = Number(body.status_id ?? body.statusId);
  if (!newStatusId) {
    return new NextResponse("Missing or invalid status_id", { status: 400 });
  }

  try {
    const updated = await changeStatus(dbQuery, {
      requestId: id,
      newStatusId,
      changedByUserId: user.id ?? null,
      changedByName: user.name ?? null,
    });

    return NextResponse.json(mapRequestRow(updated));
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", {
      status: 500,
    });
  }
}