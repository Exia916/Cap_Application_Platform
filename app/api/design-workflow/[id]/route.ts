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

function normalizeForCompare(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value ?? null;
}

function valuesDiffer(a: unknown, b: unknown) {
  const left = normalizeForCompare(a);
  const right = normalizeForCompare(b);
  return JSON.stringify(left) !== JSON.stringify(right);
}

const TRACKED_FIELDS: Array<{
  key: keyof NonNullable<UpdateRequestInput["data"]>;
  label: string;
}> = [
  { key: "request_number", label: "Request Number" },
  { key: "sales_order_number", label: "Sales Order #" },
  { key: "sales_order_base", label: "Sales Order Base" },
  { key: "po_number", label: "PO #" },
  { key: "tape_name", label: "Tape Name" },
  { key: "date_request_created", label: "Date Request Created" },
  { key: "due_date", label: "Due Date" },
  { key: "customer_name", label: "Customer" },
  { key: "customer_code", label: "Customer Code" },
  { key: "bin_code", label: "Bin #" },
  { key: "digitizer_user_id", label: "Digitizer User Id" },
  { key: "digitizer_name", label: "Digitizer" },
  { key: "designer_user_id", label: "Designer User Id" },
  { key: "designer_name", label: "Designer" },
  { key: "status_id", label: "Request Status" },
  { key: "instructions", label: "Instructions" },
  { key: "additional_instructions", label: "Additional Instructions" },
  { key: "colorways_text", label: "Colorways" },
  { key: "tape_number", label: "Tape Number" },
  { key: "rush", label: "Rush" },
  { key: "style_code", label: "Style" },
  { key: "sample_so_number", label: "Sample SO Number" },
  { key: "stitch_count", label: "Stitch Count" },
  { key: "art_proof", label: "ART PROOF" },
];

async function insertActivityHistoryRow(args: {
  entityId: string;
  fieldName: string;
  label: string;
  previousValue: unknown;
  newValue: unknown;
  userId: string | null;
  userName: string | null;
  employeeNumber: number | null;
  salesOrder: number | null;
}) {
  await dbQuery(
    `
      insert into public.activity_history (
        entity_type,
        entity_id,
        event_type,
        field_name,
        previous_value,
        new_value,
        message,
        module,
        user_id,
        user_name,
        employee_number,
        sales_order
      )
      values (
        $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12
      )
    `,
    [
      "design_workflow",
      args.entityId,
      "updated",
      args.fieldName,
      JSON.stringify(normalizeForCompare(args.previousValue)),
      JSON.stringify(normalizeForCompare(args.newValue)),
      `${args.label} updated`,
      "design_workflow",
      args.userId,
      args.userName,
      args.employeeNumber,
      args.salesOrder,
    ],
  );
}

function toNullableNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
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
    return new NextResponse(err?.message || "Internal Server Error", {
      status: 500,
    });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
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

  const before = await getRequestById(dbQuery, id, { includeVoided: true });
  if (!before) {
    return new NextResponse("Not found", { status: 404 });
  }

  const updateData: Record<string, any> = {};

  if ("requestNumber" in body) updateData.request_number = body.requestNumber;
  if ("salesOrderNumber" in body)
    updateData.sales_order_number = body.salesOrderNumber;
  if ("salesOrderBase" in body) updateData.sales_order_base = body.salesOrderBase;
  if ("poNumber" in body) updateData.po_number = body.poNumber;
  if ("tapeName" in body) updateData.tape_name = body.tapeName;
  if ("dateRequestCreated" in body)
    updateData.date_request_created = body.dateRequestCreated;
  if ("dueDate" in body) updateData.due_date = body.dueDate;
  if ("customerName" in body) updateData.customer_name = body.customerName;
  if ("customerCode" in body) updateData.customer_code = body.customerCode;
  if ("binCode" in body) updateData.bin_code = body.binCode;
  if ("digitizerUserId" in body)
    updateData.digitizer_user_id = body.digitizerUserId;
  if ("digitizerName" in body) updateData.digitizer_name = body.digitizerName;
  if ("designerUserId" in body)
    updateData.designer_user_id = body.designerUserId;
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

    const employeeNumber = toNullableNumber(
      (user as any)?.employeeNumber ?? (user as any)?.employee_number,
    );

    const salesOrderForHistory = toNullableNumber(
      updated.sales_order_base ?? updated.sales_order_number,
    );

    for (const field of TRACKED_FIELDS) {
      if (!(field.key in updateData)) continue;

      const oldValue = (before as any)[field.key];
      const newValue = (updated as any)[field.key];

      if (!valuesDiffer(oldValue, newValue)) continue;

      await insertActivityHistoryRow({
        entityId: id,
        fieldName: String(field.key),
        label: field.label,
        previousValue: oldValue,
        newValue,
        userId: (user as any)?.id ?? null,
        userName:
          (user as any)?.name ??
          (user as any)?.displayName ??
          (user as any)?.username ??
          null,
        employeeNumber,
        salesOrder: salesOrderForHistory,
      });
    }

    return NextResponse.json(mapRequestRow(updated));
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", {
      status: 500,
    });
  }
}