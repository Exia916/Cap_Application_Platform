import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getRequestById,
  updateRequest,
  type UpdateRequestInput,
} from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

const EDIT_ROLES = [
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;

  try {
    const record = await getRequestById(dbQuery, id);
    if (!record) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(mapRequestRow(record));
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!hasRole(user.role, EDIT_ROLES)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const updateData: Record<string, any> = {};

  if ("requestNumber" in body) updateData.request_number = body.requestNumber;
  if ("salesOrderNumber" in body) updateData.sales_order_number = body.salesOrderNumber;
  if ("salesOrderBase" in body) updateData.sales_order_base = body.salesOrderBase;
  if ("poNumber" in body) updateData.po_number = body.poNumber;
  if ("tapeName" in body) updateData.tape_name = body.tapeName;
  if ("dateRequestCreated" in body) updateData.date_request_created = body.dateRequestCreated;
  if ("dueDate" in body) updateData.due_date = body.dueDate;
  if ("customerName" in body) updateData.customer_name = body.customerName;
  if ("customerCode" in body) updateData.customer_code = body.customerCode;
  if ("binCode" in body) updateData.bin_code = body.binCode;
  if ("digitizerUserId" in body) updateData.digitizer_user_id = body.digitizerUserId;
  if ("digitizerName" in body) updateData.digitizer_name = body.digitizerName;
  if ("designerUserId" in body) updateData.designer_user_id = body.designerUserId;
  if ("designerName" in body) updateData.designer_name = body.designerName;
  if ("statusId" in body) updateData.status_id = Number(body.statusId);
  if ("instructions" in body) updateData.instructions = body.instructions;
  if ("additionalInstructions" in body) {
    updateData.additional_instructions = body.additionalInstructions;
  }
  if ("colorwaysText" in body) updateData.colorways_text = body.colorwaysText;
  if ("tapeNumber" in body) updateData.tape_number = body.tapeNumber;
  if ("rush" in body) updateData.rush = !!body.rush;
  if ("styleCode" in body) updateData.style_code = body.styleCode;
  if ("sampleSoNumber" in body) updateData.sample_so_number = body.sampleSoNumber;
  if ("stitchCount" in body) {
    updateData.stitch_count =
      body.stitchCount === "" || body.stitchCount == null
        ? null
        : Number(body.stitchCount);
  }
  if ("artProof" in body) updateData.art_proof = !!body.artProof;

  const input: UpdateRequestInput = {
    requestId: id,
    data: updateData,
    updatedBy: user.name ?? null,
    updatedByUserId: user.id ?? null,
  };

  try {
    const updated = await updateRequest(dbQuery, input);
    if (!updated) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(mapRequestRow(updated));
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}