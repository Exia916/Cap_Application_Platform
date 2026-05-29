import {
  getRequestById,
  type DesignWorkflowRequest,
} from "@/lib/repositories/designWorkflowRepo";
import { db } from "@/lib/db";
import {
  assignPlatformTask,
  cancelPlatformTask,
  completePlatformTask,
  createPlatformTask,
  findOpenSourceTasks,
  updateTask,
  type TaskActor,
} from "@/lib/services/platformTaskService";

const SOURCE_MODULE = "design_workflow";
const ENTITY_TYPE = "design_workflow_request";

type WorkflowAssignmentKind = "digitizer" | "designer";
type TaskAssignmentStage = "none" | "digitizing" | "design";

type AssignmentConfig = {
  kind: WorkflowAssignmentKind;
  taskType: string;
  titlePrefix: string;
  userId: string | null;
  displayName: string | null;
  stageActive: boolean;
};

function norm(v?: string | null) {
  return String(v ?? "").trim();
}

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

function ymdChicagoFromDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${yyyy}-${mm}-${dd}`;
}

function extractDatePart(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    // For DATE columns, preserve the stored calendar date instead of using
    // Date.toString(), which can introduce timezone names/Postgres parsing issues.
    const iso = value.toISOString();
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);

    return ymdChicagoFromDate(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  const isoDateMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;

  return ymdChicagoFromDate(parsed);
}

async function getTaskAssignmentStage(
  statusId: number | null | undefined,
): Promise<TaskAssignmentStage> {
  if (!statusId) return "none";

  const { rows } = await db.query<{ taskAssignmentStage: TaskAssignmentStage }>(
    `
    SELECT
      COALESCE(task_assignment_stage, 'none') AS "taskAssignmentStage"
    FROM public.design_workflow_statuses
    WHERE id = $1
    LIMIT 1
    `,
    [statusId],
  );

  const value = rows[0]?.taskAssignmentStage;

  if (value === "digitizing" || value === "design") {
    return value;
  }

  return "none";
}

function recordLabel(row: DesignWorkflowRequest) {
  return (
    row.sales_order_number ||
    row.sales_order_base ||
    row.request_number ||
    row.id
  );
}

function dueAtFromWorkflowDueDate(row: DesignWorkflowRequest) {
  const datePart = extractDatePart((row as any).due_date);

  if (!datePart) return null;

  return `${datePart} 17:00:00 America/Chicago`;
}

function sourceContext(row: DesignWorkflowRequest) {
  const createdByUserId = norm(row.created_by_user_id);

  return {
    sourceCreatedByUserId: isUuid(createdByUserId) ? createdByUserId : null,
    sourceCreatedByName: norm(row.created_by_name) || null,
    sourceBinCode: norm(row.bin_code) || null,
  };
}

function taskMetadata(row: DesignWorkflowRequest, kind: WorkflowAssignmentKind) {
  return {
    source: "workflow_assignment_sync",
    workflowRequestId: row.id,
    requestNumber: row.request_number,
    salesOrderNumber: row.sales_order_number,
    salesOrderBase: row.sales_order_base,
    statusId: row.status_id,
    statusCode: row.status_code ?? null,
    statusLabel: row.status_label ?? null,
    dueDate: extractDatePart((row as any).due_date),
    binCode: row.bin_code,
    sourceCreatedByUserId: row.created_by_user_id,
    sourceCreatedByName: row.created_by_name,
    digitizerUserId: row.digitizer_user_id,
    digitizerName: row.digitizer_name,
    designerUserId: row.designer_user_id,
    designerName: row.designer_name,
    assignmentKind: kind,
  };
}

function buildConfigs(
  row: DesignWorkflowRequest,
  stage: TaskAssignmentStage,
): AssignmentConfig[] {
  const digitizerUserId = norm(row.digitizer_user_id);
  const designerUserId = norm(row.designer_user_id);

  return [
    {
      kind: "digitizer",
      taskType: "workflow_digitizing",
      titlePrefix: "Digitize workflow request",
      userId: isUuid(digitizerUserId) ? digitizerUserId : null,
      displayName: norm(row.digitizer_name) || null,
      stageActive: stage === "digitizing",
    },
    {
      kind: "designer",
      taskType: "workflow_design",
      titlePrefix: "Design workflow request",
      userId: isUuid(designerUserId) ? designerUserId : null,
      displayName: norm(row.designer_name) || null,
      stageActive: stage === "design",
    },
  ];
}

async function previousStageWasActive(
  before: DesignWorkflowRequest | null | undefined,
  kind: WorkflowAssignmentKind,
) {
  if (!before) return false;

  const previousStage = await getTaskAssignmentStage(before.status_id);

  if (kind === "digitizer") return previousStage === "digitizing";
  return previousStage === "design";
}

async function refreshOpenTaskFromWorkflow(input: {
  taskId: string;
  after: DesignWorkflowRequest;
  config: AssignmentConfig;
  actor?: TaskActor | null;
}) {
  const { taskId, after, config, actor } = input;

  await updateTask(
    taskId,
    {
      title: `${config.titlePrefix}: ${recordLabel(after)}`,
      description: after.instructions ?? null,
      priority: after.rush ? "high" : "normal",
      dueAt: dueAtFromWorkflowDueDate(after),
      metadata: taskMetadata(after, config.kind),
      ...sourceContext(after),
    },
    actor?.userId ?? null,
  );
}

async function cancelExtraOpenTasks(input: {
  openTasks: Array<{ id: string }>;
  keepTaskId: string;
  actor?: TaskActor | null;
  message: string;
}) {
  for (const task of input.openTasks) {
    if (task.id === input.keepTaskId) continue;

    await cancelPlatformTask(task.id, input.actor, input.message);
  }
}

async function syncOneAssignment(input: {
  before?: DesignWorkflowRequest | null;
  after: DesignWorkflowRequest;
  config: AssignmentConfig;
  actor?: TaskActor | null;
}) {
  const { before, after, config, actor } = input;

  const openTasks = await findOpenSourceTasks({
    sourceModule: SOURCE_MODULE,
    entityType: ENTITY_TYPE,
    entityId: after.id,
    taskType: config.taskType,
  });

  if (after.is_voided) {
    for (const task of openTasks) {
      await cancelPlatformTask(
        task.id,
        actor,
        "Workflow request was voided; task canceled.",
      );
    }
    return;
  }

  if (!config.stageActive) {
    const wasActive = await previousStageWasActive(before, config.kind);

    for (const task of openTasks) {
      if (wasActive) {
        await completePlatformTask(task.id, actor);
      } else {
        await cancelPlatformTask(
          task.id,
          actor,
          "Workflow is no longer in this work stage.",
        );
      }
    }

    return;
  }

  if (!config.userId) {
    for (const task of openTasks) {
      await cancelPlatformTask(
        task.id,
        actor,
        "Workflow assignment was cleared or did not resolve to a CAP user.",
      );
    }

    return;
  }

  const sameAssigneeTask = openTasks.find(
    (t) => t.assignedToUserId === config.userId,
  );

  if (sameAssigneeTask) {
    await refreshOpenTaskFromWorkflow({
      taskId: sameAssigneeTask.id,
      after,
      config,
      actor,
    });

    await cancelExtraOpenTasks({
      openTasks,
      keepTaskId: sameAssigneeTask.id,
      actor,
      message: "Duplicate open Workflow task was canceled during sync.",
    });

    return;
  }

  const otherOpenTask = openTasks[0] ?? null;

  if (otherOpenTask) {
    await assignPlatformTask({
      taskId: otherOpenTask.id,
      assignedToUserId: config.userId,
      assignedToDisplayName: config.displayName,
      assignedToRole: null,
      assignedToDepartment: null,
      actor,
    });

    await refreshOpenTaskFromWorkflow({
      taskId: otherOpenTask.id,
      after,
      config,
      actor,
    });

    await cancelExtraOpenTasks({
      openTasks,
      keepTaskId: otherOpenTask.id,
      actor,
      message: "Duplicate open Workflow task was canceled during reassignment sync.",
    });

    return;
  }

  await createPlatformTask(
    {
      sourceModule: SOURCE_MODULE,
      entityType: ENTITY_TYPE,
      entityId: after.id,
      sourceRecordLabel: recordLabel(after),
      ...sourceContext(after),
      taskType: config.taskType,
      title: `${config.titlePrefix}: ${recordLabel(after)}`,
      description: after.instructions ?? null,
      assignedToUserId: config.userId,
      assignedToDisplayName: config.displayName,
      priority: after.rush ? "high" : "normal",
      dueAt: dueAtFromWorkflowDueDate(after),
      metadata: taskMetadata(after, config.kind),
    },
    actor,
  );
}

export async function syncWorkflowTasksForRequest(input: {
  requestId: string;
  before?: DesignWorkflowRequest | null;
  actor?: TaskActor | null;
}) {
  const after = await getRequestById(db.query.bind(db), input.requestId, {
    includeVoided: true,
  });

  if (!after) return;

  const stage = await getTaskAssignmentStage(after.status_id);

  for (const config of buildConfigs(after, stage)) {
    await syncOneAssignment({
      before: input.before ?? null,
      after,
      config,
      actor: input.actor ?? null,
    });
  }
}
