import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listTasks,
} from "@/lib/services/platformTaskService";
import type {
  TaskPriority,
  TaskStatus,
} from "@/lib/repositories/platformTasksRepo";

export const runtime = "nodejs";

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOf(user: any) {
  return String(user?.role ?? "").trim().toUpperCase();
}

function canManage(user: any) {
  return MANAGE_ROLES.has(roleOf(user));
}

async function countTasks(args: {
  oversight: boolean;
  user: any;
  statuses?: TaskStatus[];
  overdue?: boolean | null;
  dueToday?: boolean | null;
  priority?: TaskPriority | null;
}) {
  const result = await listTasks({
    visibleToUserId: args.oversight ? null : args.user.id,
    visibleToRole: args.oversight ? null : roleOf(args.user),
    visibleToDepartment: args.oversight ? null : args.user.department,

    statuses: args.statuses,
    overdue: args.overdue ?? null,
    dueToday: args.dueToday ?? null,
    priority: args.priority ?? null,

    page: 1,
    pageSize: 1,
    sortBy: "dueAt",
    sortDir: "asc",
  });

  return result.totalCount;
}

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope") || "mine";
  const oversight = scope === "oversight";

  if (oversight && !canManage(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeStatuses: TaskStatus[] = ["open", "in_progress", "blocked"];

  const [
    active,
    overdue,
    dueToday,
    blocked,
    highPriority,
    urgentPriority,
    completed,
    canceled,
  ] = await Promise.all([
    countTasks({
      oversight,
      user,
      statuses: activeStatuses,
    }),
    countTasks({
      oversight,
      user,
      statuses: activeStatuses,
      overdue: true,
    }),
    countTasks({
      oversight,
      user,
      statuses: activeStatuses,
      dueToday: true,
    }),
    countTasks({
      oversight,
      user,
      statuses: ["blocked"],
    }),
    countTasks({
      oversight,
      user,
      statuses: activeStatuses,
      priority: "high",
    }),
    countTasks({
      oversight,
      user,
      statuses: activeStatuses,
      priority: "urgent",
    }),
    countTasks({
      oversight,
      user,
      statuses: ["completed"],
    }),
    countTasks({
      oversight,
      user,
      statuses: ["canceled"],
    }),
  ]);

  return NextResponse.json({
    active,
    overdue,
    dueToday,
    blocked,
    highPriority: highPriority + urgentPriority,
    completed,
    canceled,
  });
}