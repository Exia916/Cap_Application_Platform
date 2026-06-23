import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExternalWorkflowContext } from "@/lib/external-access/requestContext";
import {
  assignPartnerWorkflowDigitizer,
  isExternalWorkflowValidationError,
} from "@/lib/repositories/designWorkflowExternalRepo";

const dbQuery = db.query.bind(db);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const digitizerUserId = String(body?.digitizerUserId ?? body?.userId ?? "").trim();
  if (!digitizerUserId) {
    return NextResponse.json({ error: "Digitizer is required." }, { status: 400 });
  }

  try {
    const record = await assignPartnerWorkflowDigitizer(
      dbQuery,
      access.context.partner,
      id,
      digitizerUserId,
      {
        userId: access.context.userId,
        actorName: access.context.actorName,
      },
    );

    return NextResponse.json({ record });
  } catch (err: any) {
    console.error("POST /api/partner-work/workflow/[id]/assign-digitizer failed:", err);

    const status = isExternalWorkflowValidationError(err) ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to assign digitizer." },
      { status },
    );
  }
}
