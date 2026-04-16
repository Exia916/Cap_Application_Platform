import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { voidRequest } from "@/lib/repositories/designWorkflowRepo";

const VOID_ROLES = [
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

  if (!VOID_ROLES.includes(String(user.role || "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // allow empty body
  }

  try {
    const result = await voidRequest({
      requestId: id,
      userName: user.name ?? null,
      userId: user.id ?? null,
      employeeNumber: user.employeeNumber ?? null,
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