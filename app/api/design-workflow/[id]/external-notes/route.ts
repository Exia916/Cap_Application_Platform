import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { rejectExternalUserForInternalApi } from "@/lib/external-access/routeGuards";
import { getRequestById } from "@/lib/repositories/designWorkflowRepo";
import { listDesignWorkflowExternalNotesForInternal } from "@/lib/repositories/designWorkflowExternalNotesRepo";

const dbQuery = db.query.bind(db);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const externalBlock = await rejectExternalUserForInternalApi(user);
  if (externalBlock) return externalBlock;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing Workflow request id" }, { status: 400 });
  }

  try {
    const record = await getRequestById(dbQuery, id, { includeVoided: true });
    if (!record) {
      return NextResponse.json({ error: "Workflow request not found" }, { status: 404 });
    }

    const rows = await listDesignWorkflowExternalNotesForInternal(dbQuery, id);
    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error("GET /api/design-workflow/[id]/external-notes failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load partner notes" },
      { status: 500 },
    );
  }
}
