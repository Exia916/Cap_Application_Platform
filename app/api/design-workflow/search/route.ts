import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listRequests,
  type ListRequestOptions,
} from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

function parseStringArray(values: any): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

function parseNumberArray(values: any): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
}

function parseBoolOrNull(value: any): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function mapRequestRow(row: any) {
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

export async function POST(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const rawFilters = body.filters ?? {};

  const opts: ListRequestOptions = {
    page: body.page,
    pageSize: body.pageSize,
    sortField: body.sortField,
    sortDir: body.sortDir,
    includeVoided: body.includeVoided,
    onlyVoided: body.onlyVoided,
    searchMethod: body.searchMethod === "match_any" ? "match_any" : "match_all",
    filters: {
      salesOrderNumbers: parseStringArray(rawFilters.salesOrderNumbers),
      poNumbers: parseStringArray(rawFilters.poNumbers),
      tapeNames: parseStringArray(rawFilters.tapeNames),
      createdByNames: parseStringArray(rawFilters.createdByNames),
      instructionsTerms: parseStringArray(rawFilters.instructionsTerms),
      tapeNumbers: parseStringArray(rawFilters.tapeNumbers),
      sampleSoNumbers: parseStringArray(rawFilters.sampleSoNumbers),
      stitchCounts: parseStringArray(rawFilters.stitchCounts),

      customerCodes: parseStringArray(rawFilters.customerCodes),
      binCodes: parseStringArray(rawFilters.binCodes),
      digitizerUserIds: parseStringArray(rawFilters.digitizerUserIds),
      designerUserIds: parseStringArray(rawFilters.designerUserIds),
      statusIds: parseNumberArray(rawFilters.statusIds),
      styleCodes: parseStringArray(rawFilters.styleCodes),

      rush: parseBoolOrNull(rawFilters.rush),
      artProof: parseBoolOrNull(rawFilters.artProof),

      dateRequestCreatedFrom: rawFilters.dateRequestCreatedFrom || undefined,
      dateRequestCreatedTo: rawFilters.dateRequestCreatedTo || undefined,
      dueDateFrom: rawFilters.dueDateFrom || undefined,
      dueDateTo: rawFilters.dueDateTo || undefined,
    },
  };

  try {
    const result = await listRequests(dbQuery, opts);

    return NextResponse.json({
      rows: Array.isArray(result.rows) ? result.rows.map(mapRequestRow) : [],
      totalCount: Number(result.totalCount ?? 0),
      page: Number(result.page ?? 1),
      pageSize: Number(result.pageSize ?? 25),
    });
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}