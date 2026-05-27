import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createPlatformTask,
  listTasks,
} from "@/lib/services/platformTaskService";
import type { TaskStatus, TaskPriority } from "@/lib/repositories/platformTasksRepo";

export const runtime = "nodejs";

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOf(user: any) {
  return String(user?.role ?? "").trim().toUpperCase();
}

function canManage(user: any) {
  return MANAGE_ROLES.has(roleOf(user));
}

function csvParam(v: string | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") || "mine";

  const statuses = csvParam(sp.get("status")) as TaskStatus[];

  const oversight = scope === "oversight";

  if (oversight && !canManage(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await listTasks({
    q: sp.get("q"),

    visibleToUserId: oversight ? null : user.id,
    visibleToRole: oversight ? null : roleOf(user),
    visibleToDepartment: oversight ? null : user.department,

    assignedToUserId: oversight ? sp.get("assignedToUserId") : null,
    assignedToDepartment: oversight ? sp.get("assignedToDepartment") : null,
    assignedToRole: oversight ? sp.get("assignedToRole") : null,

    sourceModule: sp.get("sourceModule"),
    taskType: sp.get("taskType"),
    priority: (sp.get("priority") || null) as TaskPriority | null,

    statuses: statuses.length ? statuses : ["open", "in_progress", "blocked"],

    overdue: sp.get("overdue") === "true" ? true : null,
    dueToday: sp.get("dueToday") === "true" ? true : null,

    page: Number(sp.get("page") || 1),
    pageSize: Number(sp.get("pageSize") || 25),

    sortBy: (sp.get("sortBy") as any) || "dueAt",
    sortDir: (sp.get("sortDir") as any) || "asc",

    includeVoided: sp.get("includeVoided") === "true",
    onlyVoided: sp.get("onlyVoided") === "true",
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManage(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  if (!body?.sourceModule || !body?.entityType || !body?.entityId || !body?.taskType) {
    return NextResponse.json(
      { error: "sourceModule, entityType, entityId, and taskType are required." },
      { status: 400 },
    );
  }

  if (!String(body?.title ?? "").trim()) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const task = await createPlatformTask(
    {
      sourceModule: String(body.sourceModule),
      entityType: String(body.entityType),
      entityId: String(body.entityId),
      sourceRecordLabel: body.sourceRecordLabel ?? null,
      taskType: String(body.taskType),
      title: String(body.title),
      description: body.description ?? null,
      assignedToUserId: body.assignedToUserId ?? null,
      assignedToRole: body.assignedToRole ?? null,
      assignedToDepartment: body.assignedToDepartment ?? null,
      assignedToDisplayName: body.assignedToDisplayName ?? null,
      priority: body.priority ?? "normal",
      dueAt: body.dueAt ?? null,
      metadata: body.metadata ?? {},
    },
    {
      userId: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
    },
  );

  return NextResponse.json({ task }, { status: 201 });
}