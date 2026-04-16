import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listRequests,
  createRequest,
  type ListRequestOptions,
} from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

const CREATE_ROLES = [
  "ADMIN",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "OVERSEAS CUSTOMER SERVICE",
];

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;

  const opts: ListRequestOptions = {
    page: params.get("page") ? Number(params.get("page")) : 1,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : 25,
    sortField: params.get("sortField") || undefined,
    sortDir: (params.get("sortDir") as "asc" | "desc" | null) ?? undefined,
    includeVoided: params.get("includeVoided") === "true" || undefined,
    onlyVoided: params.get("onlyVoided") === "true" || undefined,
    filters: {
      statusId: params.get("statusId") ? Number(params.get("statusId")) : undefined,
      digitizerUserId: params.get("digitizerUserId") || undefined,
      designerUserId: params.get("designerUserId") || undefined,
      customerCode: params.get("customerCode") || undefined,
      customerName: params.get("customerName") || undefined,
      salesOrderNumber: params.get("salesOrderNumber") || undefined,
      binCode: params.get("binCode") || undefined,
      rush: params.get("rush") != null ? params.get("rush") === "true" : undefined,
      dueDateFrom: params.get("dueDateFrom") || undefined,
      dueDateTo: params.get("dueDateTo") || undefined,
      search: params.get("search") || undefined,
    },
  };

  try {
    const result = await listRequests(dbQuery, opts);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to list design workflow requests." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!CREATE_ROLES.includes(String(user.role || "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!String(body?.requestNumber ?? body?.request_number ?? "").trim()) {
    return NextResponse.json({ error: "requestNumber is required" }, { status: 400 });
  }

  if (!Number(body?.statusId ?? body?.status_id)) {
    return NextResponse.json({ error: "statusId is required" }, { status: 400 });
  }

  try {
    const created = await createRequest(dbQuery, {
      id: randomUUID(),
      request_number: String(body.requestNumber ?? body.request_number).trim(),
      sales_order_number: body.salesOrderNumber ?? body.sales_order_number ?? null,
      po_number: body.poNumber ?? body.po_number ?? null,
      tape_name: body.tapeName ?? body.tape_name ?? null,
      date_request_created: body.dateRequestCreated ?? body.date_request_created ?? null,
      due_date: body.dueDate ?? body.due_date ?? null,
      customer_name: body.customerName ?? body.customer_name ?? null,
      customer_code: body.customerCode ?? body.customer_code ?? null,
      bin_code: body.binCode ?? body.bin_code ?? null,
      created_by_user_id: user.id ?? null,
      created_by_name: user.name ?? null,
      digitizer_user_id: body.digitizerUserId ?? body.digitizer_user_id ?? null,
      digitizer_name: body.digitizerName ?? body.digitizer_name ?? null,
      designer_user_id: body.designerUserId ?? body.designer_user_id ?? null,
      designer_name: body.designerName ?? body.designer_name ?? null,
      status_id: Number(body.statusId ?? body.status_id),
      instructions: body.instructions ?? null,
      additional_instructions:
        body.additionalInstructions ?? body.additional_instructions ?? null,
      colorways_text: body.colorwaysText ?? body.colorways_text ?? null,
      tape_number: body.tapeNumber ?? body.tape_number ?? null,
      rush: !!body.rush,
      style_code: body.styleCode ?? body.style_code ?? null,
      sample_so_number: body.sampleSoNumber ?? body.sample_so_number ?? null,
      stitch_count:
        body.stitchCount === "" || body.stitchCount == null
          ? body.stitch_count === "" || body.stitch_count == null
            ? null
            : Number(body.stitch_count)
          : Number(body.stitchCount),
      art_proof: !!(body.artProof ?? body.art_proof),
      created_by: user.name ?? null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create design workflow request." },
      { status: 500 }
    );
  }
}