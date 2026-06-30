import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { voidRequest } from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

function normalizeRole(role: string | null | undefined): string {
  return String(role || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (normalizeRole(user.role) !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { reason?: string | null } = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const result = await voidRequest(dbQuery, {
      requestId: id,
      userName: user.name ?? "",
      reason: body.reason ?? null,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to void request." },
      { status: 500 }
    );
  }
}
