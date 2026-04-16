import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { listStatusHistory } from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

function mapStatusHistoryRow(row: any) {
  return {
    id: row.id,
    requestId: row.request_id ?? null,
    statusId: row.status_id ?? null,
    statusCode: row.status_code ?? "",
    statusLabel: row.status_label ?? "",
    changedAt: row.changed_at ?? null,
    changedByUserId: row.changed_by_user_id ?? null,
    changedByName: row.changed_by_name ?? null,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;

  try {
    const history = await listStatusHistory(dbQuery, id);
    return NextResponse.json(
      Array.isArray(history) ? history.map(mapStatusHistoryRow) : []
    );
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", {
      status: 500,
    });
  }
}