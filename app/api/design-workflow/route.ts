import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listRequests,
  createRequest,
  type ListRequestOptions,
} from "@/lib/repositories/designWorkflowRepo";

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
    const result = await listRequests(opts);
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
    const created = await createRequest({
      requestNumber: String(body.requestNumber ?? body.request_number).trim(),
      salesOrderNumber: body.salesOrderNumber ?? body.sales_order_number ?? null,
      poNumber: body.poNumber ?? body.po_number ?? null,
      tapeName: body.tapeName ?? body.tape_name ?? null,
      dateRequestCreated: body.dateRequestCreated ?? body.date_request_created ?? null,
      dueDate: body.dueDate ?? body.due_date ?? null,
      customerName: body.customerName ?? body.customer_name ?? null,
      customerCode: body.customerCode ?? body.customer_code ?? null,
      binCode: body.binCode ?? body.bin_code ?? null,
      createdByUserId: user.id ?? null,
      createdByName: user.name ?? null,
      digitizerUserId: body.digitizerUserId ?? body.digitizer_user_id ?? null,
      digitizerName: body.digitizerName ?? body.digitizer_name ?? null,
      designerUserId: body.designerUserId ?? body.designer_user_id ?? null,
      designerName: body.designerName ?? body.designer_name ?? null,
      statusId: Number(body.statusId ?? body.status_id),
      instructions: body.instructions ?? null,
      additionalInstructions: body.additionalInstructions ?? body.additional_instructions ?? null,
      colorwaysText: body.colorwaysText ?? body.colorways_text ?? null,
      tapeNumber: body.tapeNumber ?? body.tape_number ?? null,
      rush: body.rush ?? false,
      styleCode: body.styleCode ?? body.style_code ?? null,
      sampleSoNumber: body.sampleSoNumber ?? body.sample_so_number ?? null,
      stitchCount:
        body.stitchCount != null
          ? Number(body.stitchCount)
          : body.stitch_count != null
            ? Number(body.stitch_count)
            : null,
      artProof: body.artProof ?? body.art_proof ?? false,
      createdBy: user.name ?? null,
      employeeNumber: user.employeeNumber ?? null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create design workflow request." },
      { status: 500 }
    );
  }
}