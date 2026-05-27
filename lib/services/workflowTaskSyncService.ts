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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

function extractDatePart(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  const s = String(value).trim();
  if (!s) return null;

  const isoDateMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
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

  // Keep this as a clean PostgreSQL-friendly timestamptz string.
  // Do not pass JavaScript Date.toString(), because it may include GMT-0500.
  return `${datePart} 17:00:00 America/Chicago`;
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

  const sameAssigneeTask = openTasks.find(
    (t) => t.assignedToUserId === config.userId,
  );

  const otherOpenTask = openTasks.find(
    (t) => t.assignedToUserId !== config.userId,
  );

  console.log("Workflow task sync assignment check:", {
    requestId: after.id,
    salesOrderNumber: after.sales_order_number,
    statusCode: after.status_code,
    statusLabel: after.status_label,
    taskType: config.taskType,
    stageActive: config.stageActive,
    assignedUserId: config.userId,
    assignedDisplayName: config.displayName,
    dueDateRaw: (after as any).due_date,
    dueAt: dueAtFromWorkflowDueDate(after),
    openTaskCount: openTasks.length,
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
    console.log(
      "Workflow task sync skipped because assignment user id is missing or not a UUID:",
      {
        requestId: after.id,
        taskType: config.taskType,
        rawDigitizerUserId: after.digitizer_user_id,
        rawDesignerUserId: after.designer_user_id,
      },
    );

    for (const task of openTasks) {
      await cancelPlatformTask(
        task.id,
        actor,
        "Workflow assignment was cleared or did not resolve to a CAP user.",
      );
    }

    return;
  }

  if (sameAssigneeTask) {
    console.log("Workflow task sync found existing matching open task:", {
      requestId: after.id,
      taskId: sameAssigneeTask.id,
      taskType: config.taskType,
      assignedUserId: config.userId,
    });
    return;
  }

  if (otherOpenTask) {
    await assignPlatformTask({
      taskId: otherOpenTask.id,
      assignedToUserId: config.userId,
      assignedToDisplayName: config.displayName,
      actor,
    });

    return;
  }

  await createPlatformTask(
    {
      sourceModule: SOURCE_MODULE,
      entityType: ENTITY_TYPE,
      entityId: after.id,
      sourceRecordLabel: recordLabel(after),
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

  console.log("Workflow task sync created task:", {
    requestId: after.id,
    taskType: config.taskType,
    assignedUserId: config.userId,
    assignedDisplayName: config.displayName,
  });
}

export async function syncWorkflowTasksForRequest(input: {
  requestId: string;
  before?: DesignWorkflowRequest | null;
  actor?: TaskActor | null;
}) {
  const after = await getRequestById(db.query.bind(db), input.requestId, {
    includeVoided: true,
  });

  if (!after) {
    console.log("Workflow task sync skipped because request was not found:", {
      requestId: input.requestId,
    });
    return;
  }

  const stage = await getTaskAssignmentStage(after.status_id);

  console.log("Workflow task sync input:", {
    requestId: after.id,
    requestNumber: after.request_number,
    salesOrderNumber: after.sales_order_number,
    salesOrderBase: after.sales_order_base,
    statusId: after.status_id,
    statusCode: after.status_code,
    statusLabel: after.status_label,
    taskAssignmentStage: stage,
    digitizerUserId: after.digitizer_user_id,
    digitizerName: after.digitizer_name,
    designerUserId: after.designer_user_id,
    designerName: after.designer_name,
    binCode: after.bin_code,
    dueDateRaw: (after as any).due_date,
    dueAt: dueAtFromWorkflowDueDate(after),
  });

  for (const config of buildConfigs(after, stage)) {
    await syncOneAssignment({
      before: input.before ?? null,
      after,
      config,
      actor: input.actor ?? null,
    });
  }
}