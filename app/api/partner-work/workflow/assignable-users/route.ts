import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExternalWorkflowContext } from "@/lib/external-access/requestContext";
import {
  isExternalWorkflowValidationError,
  listPartnerAssignableWorkflowUsers,
  type ExternalWorkflowAssignmentField,
} from "@/lib/repositories/designWorkflowExternalRepo";
import { EXTERNAL_PARTNER_TYPES } from "@/lib/external-access/constants";

const dbQuery = db.query.bind(db);

function defaultFieldForPartner(partnerType: string | null | undefined): ExternalWorkflowAssignmentField {
  return partnerType === EXTERNAL_PARTNER_TYPES.WORKFLOW_DIGITIZING
    ? "digitizer"
    : "designer";
}

function normalizeField(value: string | null, partnerType: string | null | undefined): ExternalWorkflowAssignmentField {
  if (value === "designer" || value === "digitizer") return value;
  return defaultFieldForPartner(partnerType);
}

export async function GET(req: NextRequest) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const field = normalizeField(
    req.nextUrl.searchParams.get("field"),
    access.context.partner.externalPartnerType,
  );
  const q = req.nextUrl.searchParams.get("q");

  try {
    const rows = await listPartnerAssignableWorkflowUsers(
      dbQuery,
      access.context.partner,
      field,
      q,
    );

    return NextResponse.json({ rows, field });
  } catch (err: any) {
    console.error("GET /api/partner-work/workflow/assignable-users failed:", err);

    const status = isExternalWorkflowValidationError(err) ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to load partner users." },
      { status },
    );
  }
}
