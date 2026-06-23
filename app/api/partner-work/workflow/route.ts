import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExternalWorkflowContext } from "@/lib/external-access/requestContext";
import {
  listPartnerVisibleWorkflowRequests,
  type ExternalWorkflowListOptions,
} from "@/lib/repositories/designWorkflowExternalRepo";

const dbQuery = db.query.bind(db);

export async function GET(req: NextRequest) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const params = req.nextUrl.searchParams;

  const opts: ExternalWorkflowListOptions = {
    page: params.get("page") ? Number(params.get("page")) : 1,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : 25,
    sortField: params.get("sortField"),
    sortDir: params.get("sortDir") === "asc" ? "asc" : "desc",
    search: params.get("search"),
    statusCode: params.get("statusCode"),
    dueDateFrom: params.get("dueDateFrom"),
    dueDateTo: params.get("dueDateTo"),
  };

  try {
    const result = await listPartnerVisibleWorkflowRequests(
      dbQuery,
      access.context.partner,
      opts,
    );

    return NextResponse.json({
      ...result,
      partner: {
        id: access.context.partner.externalPartnerId,
        code: access.context.partner.externalPartnerCode,
        name: access.context.partner.externalPartnerName,
        type: access.context.partner.externalPartnerType,
        role: access.context.partner.externalRole,
      },
    });
  } catch (err: any) {
    console.error("GET /api/partner-work/workflow failed:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to load partner Workflow records." },
      { status: 500 },
    );
  }
}
