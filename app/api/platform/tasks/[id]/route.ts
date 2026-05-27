import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getTaskById,
  listTaskEvents,
  updateTask,
} from "@/lib/services/platformTaskService";

export const runtime = "nodejs";

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOf(user: any) {
  return String(user?.role ?? "").trim().toUpperCase();
}

function canManage(user: any) {
  return MANAGE_ROLES.has(roleOf(user));
}

function canViewTask(user: any, task: any) {
  if (canManage(user)) return true;
  if (task.assignedToUserId && task.assignedToUserId === user.id) return true;
  if (task.assignedToRole && roleOf(user) === String(task.assignedToRole).toUpperCase()) return true;
  if (
    task.assignedToDepartment &&
    String(task.assignedToDepartment).toLowerCase() ===
      String(user.department ?? "").toLowerCase()
  ) {
    return true;
  }

  return false;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const task = await getTaskById(id, {
    includeVoided: req.nextUrl.searchParams.get("includeVoided") === "true",
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  if (!canViewTask(user, task)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const events = await listTaskEvents(id);

  return NextResponse.json({ task, events });
}

export async function PATCH(
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

  const task = await updateTask(
    id,
    {
      title: body.title,
      description: body.description,
      priority: body.priority,
      dueAt: body.dueAt,
      metadata: body.metadata,
    },
    user.id,
  );

  return NextResponse.json({ task });
}