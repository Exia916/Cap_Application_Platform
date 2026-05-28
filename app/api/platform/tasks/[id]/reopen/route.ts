import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { reopenPlatformTask } from "@/lib/services/platformTaskService";

export const runtime = "nodejs";

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function canManage(user: any) {
  return MANAGE_ROLES.has(String(user?.role ?? "").trim().toUpperCase());
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManage(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const task = await reopenPlatformTask(id, {
    userId: user.id,
    name: user.name,
    role: user.role,
    department: user.department,
  });

  return NextResponse.json({ task });
}