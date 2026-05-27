import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { cancelPlatformTask } from "@/lib/services/platformTaskService";

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!MANAGE_ROLES.has(String(user.role ?? "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const task = await cancelPlatformTask(
    id,
    {
      userId: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
    },
    body.reason || "Task canceled.",
  );

  return NextResponse.json({ task });
}