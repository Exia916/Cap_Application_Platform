import { db } from "@/lib/db";
import { createNotificationForUser } from "@/lib/services/notificationService";
import {
  assignTask as repoAssignTask,
  createTask as repoCreateTask,
  createTaskEvent,
  findOpenTaskForSource,
  findOpenTasksForSource,
  getTaskById,
  listTasks,
  listTaskEvents,
  setTaskStatus,
  updateTask,
  voidTask as repoVoidTask,
  type CreateTaskInput,
  type PlatformTaskRow,
  type TaskStatus,
} from "@/lib/repositories/platformTasksRepo";

export type TaskActor = {
  userId?: string | null;
  name?: string | null;
  role?: string | null;
  department?: string | null;
};

function actorName(actor?: TaskActor | null) {
  return actor?.name ?? "System";
}

function actorId(actor?: TaskActor | null) {
  return actor?.userId ?? null;
}

async function writeActivity(input: {
  entityType: string;
  entityId: string;
  eventType: string;
  fieldName?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  message?: string | null;
  module?: string | null;
  actor?: TaskActor | null;
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
        input.entityType,
        input.entityId,
        input.eventType,
        input.fieldName ?? null,
        input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
        input.newValue === undefined ? null : JSON.stringify(input.newValue),
        input.message ?? null,
        input.module ?? null,
        actorId(input.actor),
        actorName(input.actor),
      ],
    );
  } catch (err) {
    console.error("Task activity history write failed:", err);
  }
}

async function notifyAssignedUser(input: {
  eventType: string;
  task: PlatformTaskRow;
  actor?: TaskActor | null;
  title: string;
  message?: string | null;
}) {
  if (!input.task.assignedToUserId) return;

  try {
    await createNotificationForUser({
      eventType: input.eventType,
      module: "tasks",
      entityType: "platform_task",
      entityId: input.task.id,
      actorUserId: actorId(input.actor),
      targetUserId: input.task.assignedToUserId,
      title: input.title,
      message: input.message ?? null,
      priority:
        input.task.priority === "urgent"
          ? "urgent"
          : input.task.priority === "high"
            ? "high"
            : "normal",
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
    console.error("Task notification failed:", err);
  }
}

export async function createPlatformTask(
  input: CreateTaskInput,
  actor?: TaskActor | null,
): Promise<PlatformTaskRow> {
  const task = await repoCreateTask({
    ...input,
    createdBy: input.createdBy ?? actorId(actor),
    updatedBy: input.updatedBy ?? actorId(actor),
  });

  await createTaskEvent({
    taskId: task.id,
    eventType: "created",
    newValue: task,
    message: "Task created.",
    actorUserId: actorId(actor),
    actorName: actorName(actor),
  });

  await writeActivity({
    entityType: "platform_task",
    entityId: task.id,
    eventType: "created",
    message: "Task created.",
    module: "tasks",
    actor,
  });

  await writeActivity({
    entityType: task.entityType,
    entityId: task.entityId,
    eventType: "task_created",
    message: `Task created: ${task.title}`,
    module: task.sourceModule,
    actor,
  });

  await notifyAssignedUser({
    eventType: "task.created",
    task,
    actor,
    title: `New task: ${task.title}`,
    message: task.description,
  });

  return task;
}

export async function assignPlatformTask(input: {
  taskId: string;
  assignedToUserId?: string | null;
  assignedToRole?: string | null;
  assignedToDepartment?: string | null;
  assignedToDisplayName?: string | null;
  actor?: TaskActor | null;
}): Promise<PlatformTaskRow | null> {
  const before = await getTaskById(input.taskId, { includeVoided: true });
  if (!before) throw new Error("Task not found.");
  if (before.isVoided) throw new Error("Voided tasks cannot be reassigned.");

  const task = await repoAssignTask({
    id: input.taskId,
    assignedToUserId: input.assignedToUserId ?? null,
    assignedToRole: input.assignedToRole ?? null,
    assignedToDepartment: input.assignedToDepartment ?? null,
    assignedToDisplayName: input.assignedToDisplayName ?? null,
    updatedBy: actorId(input.actor),
  });

  if (!task) return null;

  const eventType =
    before.assignedToUserId ||
    before.assignedToRole ||
    before.assignedToDepartment
      ? "reassigned"
      : "assigned";

  await createTaskEvent({
    taskId: task.id,
    eventType,
    previousValue: {
      assignedToUserId: before.assignedToUserId,
      assignedToRole: before.assignedToRole,
      assignedToDepartment: before.assignedToDepartment,
      assignedToDisplayName: before.assignedToDisplayName,
    },
    newValue: {
      assignedToUserId: task.assignedToUserId,
      assignedToRole: task.assignedToRole,
      assignedToDepartment: task.assignedToDepartment,
      assignedToDisplayName: task.assignedToDisplayName,
    },
    message: eventType === "reassigned" ? "Task reassigned." : "Task assigned.",
    actorUserId: actorId(input.actor),
    actorName: actorName(input.actor),
  });

  await writeActivity({
    entityType: "platform_task",
    entityId: task.id,
    eventType,
    fieldName: "assigned_to",
    previousValue: before.assignedToDisplayName,
    newValue: task.assignedToDisplayName,
    message: eventType === "reassigned" ? "Task reassigned." : "Task assigned.",
    module: "tasks",
    actor: input.actor,
  });

  await notifyAssignedUser({
    eventType: eventType === "reassigned" ? "task.reassigned" : "task.assigned",
    task,
    actor: input.actor,
    title:
      eventType === "reassigned"
        ? `Task reassigned: ${task.title}`
        : `Task assigned: ${task.title}`,
    message: task.description,
  });

  return task;
}

export async function setPlatformTaskStatus(input: {
  taskId: string;
  status: TaskStatus;
  actor?: TaskActor | null;
  message?: string | null;
}): Promise<PlatformTaskRow | null> {
  const before = await getTaskById(input.taskId, { includeVoided: true });
  if (!before) throw new Error("Task not found.");
  if (before.isVoided) throw new Error("Voided tasks cannot be edited.");

  const task = await setTaskStatus({
    id: input.taskId,
    status: input.status,
    actorUserId: actorId(input.actor),
  });

  if (!task) return null;

  const eventType =
    input.status === "completed"
      ? "completed"
      : input.status === "canceled"
        ? "canceled"
        : "status_changed";

  await createTaskEvent({
    taskId: task.id,
    eventType,
    previousValue: before.status,
    newValue: task.status,
    message: input.message ?? `Task status changed to ${task.status}.`,
    actorUserId: actorId(input.actor),
    actorName: actorName(input.actor),
  });

  await writeActivity({
    entityType: "platform_task",
    entityId: task.id,
    eventType,
    fieldName: "status",
    previousValue: before.status,
    newValue: task.status,
    message: input.message ?? `Task status changed to ${task.status}.`,
    module: "tasks",
    actor: input.actor,
  });

  await writeActivity({
    entityType: task.entityType,
    entityId: task.entityId,
    eventType: `task_${eventType}`,
    fieldName: "task_status",
    previousValue: before.status,
    newValue: task.status,
    message: input.message ?? `Task ${task.title} changed to ${task.status}.`,
    module: task.sourceModule,
    actor: input.actor,
  });

  if (eventType === "canceled") {
    await notifyAssignedUser({
      eventType: "task.canceled",
      task,
      actor: input.actor,
      title: `Task canceled: ${task.title}`,
      message: input.message ?? task.description,
    });
  }

  return task;
}

export async function completePlatformTask(taskId: string, actor?: TaskActor | null) {
  return setPlatformTaskStatus({
    taskId,
    status: "completed",
    actor,
    message: "Task completed.",
  });
}

export async function cancelPlatformTask(
  taskId: string,
  actor?: TaskActor | null,
  message = "Task canceled.",
) {
  return setPlatformTaskStatus({
    taskId,
    status: "canceled",
    actor,
    message,
  });
}

export async function reopenPlatformTask(taskId: string, actor?: TaskActor | null) {
  const before = await getTaskById(taskId, { includeVoided: true });
  if (!before) throw new Error("Task not found.");
  if (before.isVoided) throw new Error("Voided tasks cannot be reopened.");

  const task = await setTaskStatus({
    id: taskId,
    status: "open",
    actorUserId: actorId(actor),
  });

  if (!task) return null;

  await createTaskEvent({
    taskId,
    eventType: "reopened",
    previousValue: before.status,
    newValue: "open",
    message: "Task reopened.",
    actorUserId: actorId(actor),
    actorName: actorName(actor),
  });

  return task;
}

export async function voidPlatformTask(input: {
  taskId: string;
  actor?: TaskActor | null;
  reason?: string | null;
}) {
  const task = await repoVoidTask({
    id: input.taskId,
    actorUserId: actorId(input.actor),
    actorName: actorName(input.actor),
    reason: input.reason ?? null,
  });

  if (!task) return null;

  await createTaskEvent({
    taskId: task.id,
    eventType: "voided",
    newValue: { reason: input.reason ?? null },
    message: input.reason ? `Task voided: ${input.reason}` : "Task voided.",
    actorUserId: actorId(input.actor),
    actorName: actorName(input.actor),
  });

  return task;
}

export async function findOpenSourceTask(input: {
  sourceModule: string;
  entityType: string;
  entityId: string;
  taskType: string;
  assignedToUserId?: string | null;
}) {
  return findOpenTaskForSource(input);
}

export async function findOpenSourceTasks(input: {
  sourceModule: string;
  entityType: string;
  entityId: string;
  taskType?: string | null;
  assignedToUserId?: string | null;
}) {
  return findOpenTasksForSource(input);
}

export { listTasks, listTaskEvents, updateTask, getTaskById };