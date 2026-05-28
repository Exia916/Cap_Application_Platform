import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { assignPlatformTask } from "@/lib/services/platformTaskService";
import { getAssignableUserById } from "@/lib/repositories/assignableUsersRepo";

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
  const body = await req.json().catch(() => ({}));

  const assignedToUserId = String(body?.assignedToUserId ?? "").trim();

  if (!assignedToUserId) {
    return NextResponse.json(
      { error: "assignedToUserId is required." },
      { status: 400 },
    );
  }

  const assignedUser = await getAssignableUserById(assignedToUserId);

  if (!assignedUser) {
    return NextResponse.json(
      { error: "Assigned user was not found or is not active." },
      { status: 400 },
    );
  }

  const task = await assignPlatformTask({
    taskId: id,
    assignedToUserId: assignedUser.id,
    assignedToDisplayName:
      assignedUser.displayName ||
      assignedUser.username ||
      `User ${assignedUser.id}`,
    assignedToRole: null,
    assignedToDepartment: null,
    actor: {
      userId: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
    },
  });

  return NextResponse.json({ task });
}