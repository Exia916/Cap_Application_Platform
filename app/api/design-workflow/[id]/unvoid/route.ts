import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { unvoidRequest } from "@/lib/repositories/designWorkflowRepo";

const UNVOID_ROLES = [
  "ADMIN",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "OVERSEAS CUSTOMER SERVICE",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!UNVOID_ROLES.includes(String(user.role || "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await unvoidRequest({
      requestId: params.id,
      userName: user.name ?? null,
      userId: user.id ?? null,
      employeeNumber: user.employeeNumber ?? null,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to unvoid request." },
      { status: 500 }
    );
  }
}