import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createComment,
  listCommentsByEntity,
} from "@/lib/repositories/commentsRepo";
import { getTaskById } from "@/lib/services/platformTaskService";
import { createNotificationForUser } from "@/lib/services/notificationService";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "TECH",
  "WAREHOUSE",
  "USER",
  "OPERATOR",
  "CUSTOMER SERVICE",
  "OVERSEAS CUSTOMER SERVICE",
  "ORDER PROCESSING",
  "ART",
  "DIGITIZING",
  "PURCHASING",
  "SALES",
]);

const TASK_MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

type AuthIdentity = {
  publicUserId: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
  department: string | null;
};

function roleOf(auth: any) {
  return String(auth?.role ?? "").trim().toUpperCase();
}

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

function canManageTasks(auth: any) {
  return TASK_MANAGE_ROLES.has(roleOf(auth));
}

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

function authDisplayName(auth: any) {
  return (
    cleanString(auth?.displayName) ||
    cleanString(auth?.name) ||
    cleanString(auth?.username) ||
    null
  );
}

function authEmployeeNumber(auth: any) {
  const raw =
    auth?.employeeNumber ??
    auth?.employee_number ??
    null;

  const empNum = Number(raw);

  return Number.isFinite(empNum) ? Math.trunc(empNum) : null;
}

async function resolveAuthIdentity(auth: any): Promise<AuthIdentity> {
  const idCandidate = cleanString(auth?.id);

  if (isUuid(idCandidate)) {
    return {
      publicUserId: idCandidate,
      displayName: authDisplayName(auth),
      employeeNumber: authEmployeeNumber(auth),
      role: cleanString(auth?.role) || null,
      department: cleanString(auth?.department) || null,
    };
  }

  const username = cleanString(auth?.username);
  const employeeNumber = authEmployeeNumber(auth);

  if (!username && employeeNumber == null) {
    return {
      publicUserId: null,
      displayName: authDisplayName(auth),
      employeeNumber,
      role: cleanString(auth?.role) || null,
      department: cleanString(auth?.department) || null,
    };
  }

  const { rows } = await db.query<{
    id: string;
    displayName: string | null;
    employeeNumber: number | null;
    role: string | null;
    department: string | null;
  }>(
    `
    SELECT
      u.id::text AS "id",
      u.display_name AS "displayName",
      u.employee_number AS "employeeNumber",
      u.role,
      u.department
    FROM public.users u
    WHERE
      ($1 <> '' AND u.username = $1)
      OR ($2::int IS NOT NULL AND u.employee_number = $2::int)
    ORDER BY u.is_active DESC, u.display_name ASC NULLS LAST
    LIMIT 1
    `,
    [username, employeeNumber],
  );

  const row = rows[0] ?? null;

  return {
    publicUserId: row?.id ?? null,
    displayName: row?.displayName ?? authDisplayName(auth),
    employeeNumber: row?.employeeNumber ?? employeeNumber,
    role: (row?.role ?? cleanString(auth?.role)) || null,
    department: (row?.department ?? cleanString(auth?.department)) || null,
  };
}

function canViewTask(input: {
  auth: any;
  identity: AuthIdentity;
  task: any;
}) {
  const { auth, identity, task } = input;

  if (canManageTasks(auth)) return true;

  if (
    task.assignedToUserId &&
    identity.publicUserId &&
    task.assignedToUserId === identity.publicUserId
  ) {
    return true;
  }

  if (
    task.assignedToRole &&
    roleOf(auth) === String(task.assignedToRole).trim().toUpperCase()
  ) {
    return true;
  }

  if (
    task.assignedToDepartment &&
    String(task.assignedToDepartment).trim().toLowerCase() ===
      String(identity.department ?? auth?.department ?? "").trim().toLowerCase()
  ) {
    return true;
  }

  return false;
}

async function requireEntityAccess(input: {
  auth: any;
  identity: AuthIdentity;
  entityType: string;
  entityId: string;
}) {
  if (input.entityType !== "platform_task") {
    return { ok: true as const };
  }

  const task = await getTaskById(input.entityId, { includeVoided: true });

  if (!task) {
    return {
      ok: false as const,
      status: 404,
      error: "Task was not found.",
    };
  }

  if (!canViewTask({ auth: input.auth, identity: input.identity, task })) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
    };
  }

  return { ok: true as const, task };
}

function notificationPriorityFromTask(task: any) {
  if (task.priority === "urgent") return "urgent";
  if (task.priority === "high") return "high";
  return "normal";
}

function shortMessage(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177)}...`;
}

async function writeTaskCommentActivity(input: {
  task: any;
  commentId: number;
  commentText: string;
  actorUserId: string | null;
  actorName: string | null;
}) {
  try {
    await db.query(
      `
      INSERT INTO public.activity_history (
        entity_type,
        entity_id,
        event_type,
        field_name,
        previous_value,
        new_value,
        message,
        module,
        user_id,
        user_name
      )
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10)
      `,
      [
        "platform_task",
        input.task.id,
        "comment_added",
        null,
        null,
        JSON.stringify({
          commentId: input.commentId,
          commentText: input.commentText,
        }),
        "Comment added to task.",
        "tasks",
        input.actorUserId,
        input.actorName,
      ],
    );
  } catch (err) {
    console.error("Task comment activity history write failed:", err);
  }
}

async function notifyTaskAssigneeOfComment(input: {
  task: any;
  commentText: string;
  actorUserId: string | null;
  actorName: string | null;
}) {
  if (!input.task.assignedToUserId) return;
  if (input.task.assignedToUserId === input.actorUserId) return;

  try {
    await createNotificationForUser({
      eventType: "task.comment.created",
      module: "tasks",
      entityType: "platform_task",
      entityId: input.task.id,
      actorUserId: input.actorUserId,
      targetUserId: input.task.assignedToUserId,
      title: `New comment on task #${input.task.taskNumber}`,
      message: `${input.actorName || "Someone"}: ${shortMessage(input.commentText)}`,
      priority: notificationPriorityFromTask(input.task),
      payload: {
        taskId: input.task.id,
        taskNumber: input.task.taskNumber,
        sourceModule: input.task.sourceModule,
        entityType: input.task.entityType,
        entityId: input.task.entityId,
        taskType: input.task.taskType,
      },
      channels: ["in_app"],
    });
  } catch (err) {
    console.error("Task comment notification failed:", err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!roleOk((auth as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const identity = await resolveAuthIdentity(auth);

    const { searchParams } = new URL(req.url);
    const entityType = String(searchParams.get("entityType") || "").trim();
    const entityId = String(searchParams.get("entityId") || "").trim();
    const limitRaw = Number.parseInt(String(searchParams.get("limit") || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 },
      );
    }

    const access = await requireEntityAccess({
      auth,
      identity,
      entityType,
      entityId,
    });

    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const rows = await listCommentsByEntity(entityType, entityId, limit);

    return NextResponse.json({ rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load comments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!roleOk((auth as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const identity = await resolveAuthIdentity(auth);

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const entityType = String((body as any).entityType || "").trim();
    const entityId = String((body as any).entityId || "").trim();
    const commentText = String((body as any).commentText || "").trim();

    if (!entityType || !entityId || !commentText) {
      return NextResponse.json(
        { error: "entityType, entityId, and commentText are required" },
        { status: 400 },
      );
    }

    const access = await requireEntityAccess({
      auth,
      identity,
      entityType,
      entityId,
    });

    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const row = await createComment({
      entityType,
      entityId,
      commentText,
      createdByUserId: identity.publicUserId,
      createdByName: identity.displayName,
      employeeNumber: identity.employeeNumber,
    });

    if (entityType === "platform_task" && "task" in access) {
      await writeTaskCommentActivity({
        task: access.task,
        commentId: row.id,
        commentText,
        actorUserId: identity.publicUserId,
        actorName: identity.displayName,
      });

      await notifyTaskAssigneeOfComment({
        task: access.task,
        commentText,
        actorUserId: identity.publicUserId,
        actorName: identity.displayName,
      });
    }

    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create comment" },
      { status: 500 },
    );
  }
}