import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { unvoidRequest } from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

const UNVOID_ROLES = [
  "ADMIN",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "OVERSEAS CUSTOMER SERVICE",
];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!UNVOID_ROLES.includes(String(user.role || "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const result = await unvoidRequest(dbQuery, {
      requestId: id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to unvoid request." },
      { status: 500 }
    );
  }
}