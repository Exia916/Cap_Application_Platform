import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireExternalWorkflowCapability,
  requireExternalWorkflowContext,
} from "@/lib/external-access/requestContext";
import {
  completePartnerWorkflowDigitizing,
  isExternalWorkflowValidationError,
} from "@/lib/repositories/designWorkflowExternalRepo";

const dbQuery = db.query.bind(db);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const capabilityBlock = requireExternalWorkflowCapability(access.context.partner, "canComplete");
  if (capabilityBlock) return capabilityBlock;

  const { id } = await context.params;

  try {
    const result = await completePartnerWorkflowDigitizing(
      dbQuery,
      access.context.partner,
      id,
      {
        userId: access.context.userId,
        actorName: access.context.actorName,
      },
    );

    return NextResponse.json({ result });
  } catch (err: any) {
    console.error("POST /api/partner-work/workflow/[id]/complete-digitizing failed:", err);

    const status = isExternalWorkflowValidationError(err) ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to complete digitizing work." },
      { status },
    );
  }
}
