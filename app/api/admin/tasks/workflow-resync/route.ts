import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncWorkflowTasksForRequest } from "@/lib/services/workflowTaskSyncService";

export const runtime = "nodejs";

type TaskStage = "none" | "digitizing" | "design";

type WorkflowCandidateRow = {
  id: string;
  requestNumber: string | null;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  statusId: number | null;
  statusCode: string | null;
  statusLabel: string | null;
  taskAssignmentStage: TaskStage;
  digitizerUserId: string | null;
  digitizerName: string | null;
  designerUserId: string | null;
  designerName: string | null;
  isVoided: boolean;
  createdAt: string;
};

type OpenTaskRow = {
  id: string;
  taskType: string;
  assignedToUserId: string | null;
  assignedToDisplayName: string | null;
  status: string;
};

type DryRunAction =
  | "create"
  | "refresh"
  | "reassign"
  | "cancel"
  | "none";

type DryRunSample = {
  requestId: string;
  requestNumber: string | null;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  statusLabel: string | null;
  taskAssignmentStage: TaskStage;
  expectedTaskType: string | null;
  expectedUserId: string | null;
  expectedUserName: string | null;
  openTaskCount: number;
  action: DryRunAction;
  note: string;
};

function roleOf(user: any) {
  return String(user?.role ?? "").trim().toUpperCase();
}

function isAdmin(user: any) {
  return roleOf(user) === "ADMIN";
}

function actorName(user: any) {
  return (
    user?.name ??
    user?.displayName ??
    user?.username ??
    "Admin"
  );
}

function toSafeLimit(value: unknown, fallback = 100, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function cleanString(value: unknown) {
  const s = String(value ?? "").trim();
  return s || null;
}

function normalizeStage(value: unknown): TaskStage | null {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) return null;

  if (raw === "none" || raw === "digitizing" || raw === "design") {
    return raw;
  }

  return null;
}

function expectedForWorkflow(row: WorkflowCandidateRow): {
  taskType: string | null;
  userId: string | null;
  userName: string | null;
} {
  if (row.isVoided) {
    return { taskType: null, userId: null, userName: null };
  }

  if (row.taskAssignmentStage === "digitizing") {
    return {
      taskType: "workflow_digitizing",
      userId: row.digitizerUserId,
      userName: row.digitizerName,
    };
  }

  if (row.taskAssignmentStage === "design") {
    return {
      taskType: "workflow_design",
      userId: row.designerUserId,
      userName: row.designerName,
    };
  }

  return { taskType: null, userId: null, userName: null };
}

async function findCandidates(input: {
  requestId?: string | null;
  salesOrderNumber?: string | null;
  statusStage?: TaskStage | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  includeVoided?: boolean;
  limit: number;
}) {
  const where: string[] = [];
  const params: any[] = [];

  if (!input.includeVoided) {
    where.push(`COALESCE(dwr.is_voided, false) = false`);
  }

  if (input.requestId) {
    params.push(input.requestId);
    where.push(`dwr.id::text = $${params.length}`);
  }

  if (input.salesOrderNumber) {
    params.push(input.salesOrderNumber);
    const exact = `$${params.length}`;

    params.push(`%${input.salesOrderNumber}%`);
    const like = `$${params.length}`;

    where.push(`(
      dwr.sales_order_number = ${exact}
      OR dwr.sales_order_base = ${exact}
      OR dwr.request_number = ${exact}
      OR dwr.sales_order_number ILIKE ${like}
      OR dwr.sales_order_base ILIKE ${like}
      OR dwr.request_number ILIKE ${like}
    )`);
  }

  if (input.statusStage) {
    params.push(input.statusStage);
    where.push(`COALESCE(s.task_assignment_stage, 'none') = $${params.length}`);
  }

  if (input.createdFrom) {
    params.push(input.createdFrom);
    where.push(`DATE(dwr.created_at) >= $${params.length}`);
  }

  if (input.createdTo) {
    params.push(input.createdTo);
    where.push(`DATE(dwr.created_at) <= $${params.length}`);
  }

  params.push(input.limit);
  const limitParam = `$${params.length}`;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await db.query<WorkflowCandidateRow>(
    `
    SELECT
      dwr.id::text AS "id",
      dwr.request_number AS "requestNumber",
      dwr.sales_order_number AS "salesOrderNumber",
      dwr.sales_order_base AS "salesOrderBase",
      dwr.status_id AS "statusId",
      s.code AS "statusCode",
      s.label AS "statusLabel",
      COALESCE(s.task_assignment_stage, 'none') AS "taskAssignmentStage",
      dwr.digitizer_user_id AS "digitizerUserId",
      dwr.digitizer_name AS "digitizerName",
      dwr.designer_user_id AS "designerUserId",
      dwr.designer_name AS "designerName",
      COALESCE(dwr.is_voided, false) AS "isVoided",
      dwr.created_at AS "createdAt"
    FROM public.design_workflow_requests dwr
    JOIN public.design_workflow_statuses s
      ON s.id = dwr.status_id
    ${whereSql}
    ORDER BY dwr.created_at DESC
    LIMIT ${limitParam}
    `,
    params,
  );

  return rows;
}

async function findOpenWorkflowTasks(requestId: string) {
  const { rows } = await db.query<OpenTaskRow>(
    `
    SELECT
      id::text AS "id",
      task_type AS "taskType",
      assigned_to_user_id::text AS "assignedToUserId",
      assigned_to_display_name AS "assignedToDisplayName",
      status
    FROM public.platform_tasks
    WHERE source_module = 'design_workflow'
      AND entity_type = 'design_workflow_request'
      AND entity_id = $1
      AND task_type IN ('workflow_digitizing', 'workflow_design')
      AND status IN ('open', 'in_progress', 'blocked')
      AND COALESCE(is_voided, false) = false
    ORDER BY created_at ASC
    `,
    [requestId],
  );

  return rows;
}

async function classify(row: WorkflowCandidateRow): Promise<DryRunSample> {
  const openTasks = await findOpenWorkflowTasks(row.id);
  const expected = expectedForWorkflow(row);
  const wrongStageOpenTasks = expected.taskType
    ? openTasks.filter((t) => t.taskType !== expected.taskType)
    : openTasks;

  if (row.isVoided) {
    return {
      requestId: row.id,
      requestNumber: row.requestNumber,
      salesOrderNumber: row.salesOrderNumber,
      salesOrderBase: row.salesOrderBase,
      statusLabel: row.statusLabel,
      taskAssignmentStage: row.taskAssignmentStage,
      expectedTaskType: null,
      expectedUserId: null,
      expectedUserName: null,
      openTaskCount: openTasks.length,
      action: openTasks.length > 0 ? "cancel" : "none",
      note:
        openTasks.length > 0
          ? "Workflow is voided; open Workflow tasks would be canceled."
          : "Workflow is voided and has no open Workflow tasks.",
    };
  }

  if (!expected.taskType) {
    return {
      requestId: row.id,
      requestNumber: row.requestNumber,
      salesOrderNumber: row.salesOrderNumber,
      salesOrderBase: row.salesOrderBase,
      statusLabel: row.statusLabel,
      taskAssignmentStage: row.taskAssignmentStage,
      expectedTaskType: null,
      expectedUserId: null,
      expectedUserName: null,
      openTaskCount: openTasks.length,
      action: openTasks.length > 0 ? "cancel" : "none",
      note:
        openTasks.length > 0
          ? "Status is not task-generating; open Workflow tasks would be canceled."
          : "Status is not task-generating and no open Workflow tasks exist.",
    };
  }

  const matchingTypeTasks = openTasks.filter(
    (t) => t.taskType === expected.taskType,
  );

  const sameAssigneeTask = matchingTypeTasks.find(
    (t) => t.assignedToUserId === expected.userId,
  );

  const otherAssigneeTask = matchingTypeTasks.find(
    (t) => t.assignedToUserId !== expected.userId,
  );

  if (!expected.userId) {
    return {
      requestId: row.id,
      requestNumber: row.requestNumber,
      salesOrderNumber: row.salesOrderNumber,
      salesOrderBase: row.salesOrderBase,
      statusLabel: row.statusLabel,
      taskAssignmentStage: row.taskAssignmentStage,
      expectedTaskType: expected.taskType,
      expectedUserId: null,
      expectedUserName: expected.userName,
      openTaskCount: openTasks.length,
      action: matchingTypeTasks.length > 0 ? "cancel" : "none",
      note:
        matchingTypeTasks.length > 0
          ? "Task stage is active, but assignment is missing; matching open tasks would be canceled."
          : "Task stage is active, but assignment is missing.",
    };
  }

  if (sameAssigneeTask) {
    return {
      requestId: row.id,
      requestNumber: row.requestNumber,
      salesOrderNumber: row.salesOrderNumber,
      salesOrderBase: row.salesOrderBase,
      statusLabel: row.statusLabel,
      taskAssignmentStage: row.taskAssignmentStage,
      expectedTaskType: expected.taskType,
      expectedUserId: expected.userId,
      expectedUserName: expected.userName,
      openTaskCount: openTasks.length,
      action: "refresh",
      note:
        wrongStageOpenTasks.length > 0
          ? "Matching open task exists and would be refreshed. Other open Workflow stage tasks would be canceled by sync."
          : "Matching open task exists and would be refreshed.",
    };
  }

  if (otherAssigneeTask) {
    return {
      requestId: row.id,
      requestNumber: row.requestNumber,
      salesOrderNumber: row.salesOrderNumber,
      salesOrderBase: row.salesOrderBase,
      statusLabel: row.statusLabel,
      taskAssignmentStage: row.taskAssignmentStage,
      expectedTaskType: expected.taskType,
      expectedUserId: expected.userId,
      expectedUserName: expected.userName,
      openTaskCount: openTasks.length,
      action: "reassign",
      note:
        wrongStageOpenTasks.length > 0
          ? "Open task exists for this stage but assigned user differs; it would be reassigned. Other open Workflow stage tasks would be canceled by sync."
          : "Open task exists for this stage but assigned user differs; it would be reassigned.",
    };
  }

  return {
    requestId: row.id,
    requestNumber: row.requestNumber,
    salesOrderNumber: row.salesOrderNumber,
    salesOrderBase: row.salesOrderBase,
    statusLabel: row.statusLabel,
    taskAssignmentStage: row.taskAssignmentStage,
    expectedTaskType: expected.taskType,
    expectedUserId: expected.userId,
    expectedUserName: expected.userName,
    openTaskCount: openTasks.length,
    action: "create",
    note:
      wrongStageOpenTasks.length > 0
        ? "No matching open task exists; one would be created. Other open Workflow stage tasks would be canceled by sync."
        : "No matching open task exists; one would be created.",
  };
}

async function writeResyncActivity(input: {
  actorUserId: string | null;
  actorName: string | null;
  summary: any;
}) {
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
      "platform_task_resync",
      randomUUID(),
      "workflow_task_resync",
      null,
      null,
      JSON.stringify(input.summary),
      "Workflow task resync executed.",
      "tasks",
      input.actorUserId,
      input.actorName,
    ],
  );
}

export async function POST(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const dryRun = body?.dryRun !== false;
  const confirm = String(body?.confirm ?? "").trim();

  if (!dryRun && confirm !== "RESYNC_WORKFLOW_TASKS") {
    return NextResponse.json(
      {
        error:
          'Actual resync requires confirm: "RESYNC_WORKFLOW_TASKS". Run dry run first.',
      },
      { status: 400 },
    );
  }

  const requestId = cleanString(body?.requestId);
  const salesOrderNumber = cleanString(body?.salesOrderNumber);
  const createdFrom = cleanString(body?.createdFrom);
  const createdTo = cleanString(body?.createdTo);
  const statusStageRaw = cleanString(body?.statusStage);
  const statusStage = normalizeStage(statusStageRaw);
  const includeVoided = body?.includeVoided === true;
  const limit = toSafeLimit(body?.limit);

  if (statusStageRaw && !statusStage) {
    return NextResponse.json(
      { error: "statusStage must be none, digitizing, or design." },
      { status: 400 },
    );
  }

  const candidates = await findCandidates({
    requestId,
    salesOrderNumber,
    statusStage,
    createdFrom,
    createdTo,
    includeVoided,
    limit,
  });

  const samples: DryRunSample[] = [];

  for (const row of candidates) {
    samples.push(await classify(row));
  }

  const summary = {
    dryRun,
    matchedWorkflowCount: candidates.length,
    create: samples.filter((s) => s.action === "create").length,
    refresh: samples.filter((s) => s.action === "refresh").length,
    reassign: samples.filter((s) => s.action === "reassign").length,
    cancel: samples.filter((s) => s.action === "cancel").length,
    none: samples.filter((s) => s.action === "none").length,
    filters: {
      requestId,
      salesOrderNumber,
      statusStage,
      createdFrom,
      createdTo,
      includeVoided,
      limit,
    },
  };

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      summary,
      samples: samples.slice(0, 250),
    });
  }

  let processedCount = 0;
  const failures: Array<{ requestId: string; error: string }> = [];

  for (const row of candidates) {
    try {
      await syncWorkflowTasksForRequest({
        requestId: row.id,
        actor: {
          userId: user.id ?? null,
          name: actorName(user),
          role: user.role ?? null,
          department: user.department ?? null,
        },
      });

      processedCount += 1;
    } catch (err: any) {
      failures.push({
        requestId: row.id,
        error: err?.message || "Workflow task sync failed.",
      });
    }
  }

  const actualSummary = {
    ...summary,
    processedCount,
    failureCount: failures.length,
  };

  await writeResyncActivity({
    actorUserId: user.id ?? null,
    actorName: actorName(user),
    summary: actualSummary,
  });

  return NextResponse.json({
    ok: failures.length === 0,
    summary: actualSummary,
    failures,
    samples: samples.slice(0, 250),
  });
}