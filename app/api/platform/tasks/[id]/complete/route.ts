import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  completePlatformTask,
  getTaskById,
} from "@/lib/services/platformTaskService";

export const runtime = "nodejs";

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOf(user: any) {
  return String(user?.role ?? "").trim().toUpperCase();
}

function canManage(user: any) {
  return MANAGE_ROLES.has(roleOf(user));
}

function canActOnTask(user: any, task: any) {
  if (canManage(user)) return true;

  if (task.assignedToUserId && task.assignedToUserId === user.id) {
    return true;
  }

  if (
    task.assignedToRole &&
    roleOf(user) === String(task.assignedToRole).trim().toUpperCase()
  ) {
    return true;
  }

  if (
    task.assignedToDepartment &&
    String(task.assignedToDepartment).trim().toLowerCase() ===
      String(user.department ?? "").trim().toLowerCase()
  ) {
    return true;
  }

  return false;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await getTaskById(id, { includeVoided: true });

  if (!existing) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (!canActOnTask(user, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await completePlatformTask(id, {
    userId: user.id,
    name: user.name,
    role: user.role,
    department: user.department,
  });

  return NextResponse.json({ task });
}