import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireExternalWorkflowCapability,
  requireExternalWorkflowContext,
} from "@/lib/external-access/requestContext";
import {
  addPartnerWorkflowNote,
  isExternalWorkflowValidationError,
  listPartnerWorkflowNotes,
} from "@/lib/repositories/designWorkflowExternalRepo";

const dbQuery = db.query.bind(db);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const capabilityBlock = requireExternalWorkflowCapability(access.context.partner, "canNote");
  if (capabilityBlock) return capabilityBlock;

  const { id } = await context.params;

  try {
    const rows = await listPartnerWorkflowNotes(
      dbQuery,
      access.context.partner,
      id,
    );

    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error("GET /api/partner-work/workflow/[id]/notes failed:", err);

    const status = isExternalWorkflowValidationError(err) ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to load partner notes." },
      { status },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const capabilityBlock = requireExternalWorkflowCapability(access.context.partner, "canNote");
  if (capabilityBlock) return capabilityBlock;

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const note = await addPartnerWorkflowNote(
      dbQuery,
      access.context.partner,
      id,
      String(body?.noteText ?? body?.note ?? ""),
      {
        userId: access.context.userId,
        actorName: access.context.actorName,
      },
    );

    return NextResponse.json({ note }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/partner-work/workflow/[id]/notes failed:", err);

    const status = isExternalWorkflowValidationError(err) ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to add partner note." },
      { status },
    );
  }
}
