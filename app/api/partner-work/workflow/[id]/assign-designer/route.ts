import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExternalWorkflowContext } from "@/lib/external-access/requestContext";
import {
  assignPartnerWorkflowDesigner,
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

  const designerUserId = String(body?.designerUserId ?? body?.userId ?? "").trim();
  if (!designerUserId) {
    return NextResponse.json({ error: "Designer is required." }, { status: 400 });
  }

  try {
    const record = await assignPartnerWorkflowDesigner(
      dbQuery,
      access.context.partner,
      id,
      designerUserId,
      {
        userId: access.context.userId,
        actorName: access.context.actorName,
      },
    );

    return NextResponse.json({ record });
  } catch (err: any) {
    console.error("POST /api/partner-work/workflow/[id]/assign-designer failed:", err);

    const status = isExternalWorkflowValidationError(err) ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to assign designer." },
      { status },
    );
  }
}
