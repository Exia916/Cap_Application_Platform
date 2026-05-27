import { db } from "@/lib/db";
import {
  buildVoidedWhereClause,
  joinWhere,
  pushWhere,
} from "./_shared/repoFilters";
import {
  resolveVoidMode,
  type StandardRepoOptions,
} from "./_shared/repoTypes";

export type TaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "completed"
  | "canceled"
  | "voided";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskEventType =
  | "created"
  | "assigned"
  | "reassigned"
  | "due_date_changed"
  | "status_changed"
  | "completed"
  | "canceled"
  | "reopened"
  | "voided";

export type PlatformTaskRow = {
  id: string;
  taskNumber: number;
  taskKey: string | null;

  sourceModule: string;
  entityType: string;
  entityId: string;
  sourceRecordLabel: string | null;

  taskType: string;

  title: string;
  description: string | null;

  assignedToUserId: string | null;
  assignedToRole: string | null;
  assignedToDepartment: string | null;
  assignedToDisplayName: string | null;

  priority: TaskPriority;
  status: TaskStatus;

  dueAt: string | null;

  completedAt: string | null;
  completedBy: string | null;

  canceledAt: string | null;
  canceledBy: string | null;

  createdAt: string;
  createdBy: string | null;

  updatedAt: string;
  updatedBy: string | null;

  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;

  metadata: any;
};

export type PlatformTaskEventRow = {
  id: number;
  taskId: string;
  eventType: TaskEventType;
  previousValue: any | null;
  newValue: any | null;
  message: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
  metadata: any;
};

export type ListTasksArgs = StandardRepoOptions & {
  q?: string | null;

  visibleToUserId?: string | null;
  visibleToRole?: string | null;
  visibleToDepartment?: string | null;

  assignedToUserId?: string | null;
  assignedToRole?: string | null;
  assignedToDepartment?: string | null;

  sourceModule?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  taskType?: string | null;

  statuses?: TaskStatus[];
  priority?: TaskPriority | null;

  overdue?: boolean | null;
  dueToday?: boolean | null;

  page?: number;
  pageSize?: number;

  sortBy?:
    | "taskNumber"
    | "sourceModule"
    | "taskType"
    | "title"
    | "assignedToDisplayName"
    | "priority"
    | "status"
    | "dueAt"
    | "createdAt"
    | "updatedAt";

  sortDir?: "asc" | "desc";
};

export type PagedTaskResult = {
  rows: PlatformTaskRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type CreateTaskInput = {
  taskKey?: string | null;

  sourceModule: string;
  entityType: string;
  entityId: string;
  sourceRecordLabel?: string | null;

  taskType: string;

  title: string;
  description?: string | null;

  assignedToUserId?: string | null;
  assignedToRole?: string | null;
  assignedToDepartment?: string | null;
  assignedToDisplayName?: string | null;

  priority?: TaskPriority;
  status?: TaskStatus;

  dueAt?: string | Date | null;

  createdBy?: string | null;
  updatedBy?: string | null;

  metadata?: unknown;
};

function taskSelectSql() {
  return `
    SELECT
      t.id::text AS "id",
      t.task_number AS "taskNumber",
      t.task_key AS "taskKey",

      t.source_module AS "sourceModule",
      t.entity_type AS "entityType",
      t.entity_id AS "entityId",
      t.source_record_label AS "sourceRecordLabel",

      t.task_type AS "taskType",

      t.title,
      t.description,

      t.assigned_to_user_id::text AS "assignedToUserId",
      t.assigned_to_role AS "assignedToRole",
      t.assigned_to_department AS "assignedToDepartment",
      t.assigned_to_display_name AS "assignedToDisplayName",

      t.priority,
      t.status,

      t.due_at AS "dueAt",

      t.completed_at AS "completedAt",
      t.completed_by::text AS "completedBy",

      t.canceled_at AS "canceledAt",
      t.canceled_by::text AS "canceledBy",

      t.created_at AS "createdAt",
      t.created_by::text AS "createdBy",

      t.updated_at AS "updatedAt",
      t.updated_by::text AS "updatedBy",

      COALESCE(t.is_voided, false) AS "isVoided",
      t.voided_at AS "voidedAt",
      t.voided_by AS "voidedBy",
      t.void_reason AS "voidReason",

      t.metadata
    FROM public.platform_tasks t
  `;
}

function taskSelectFromInsertedSql() {
  return `
    SELECT
      t.id::text AS "id",
      t.task_number AS "taskNumber",
      t.task_key AS "taskKey",

      t.source_module AS "sourceModule",
      t.entity_type AS "entityType",
      t.entity_id AS "entityId",
      t.source_record_label AS "sourceRecordLabel",

      t.task_type AS "taskType",

      t.title,
      t.description,

      t.assigned_to_user_id::text AS "assignedToUserId",
      t.assigned_to_role AS "assignedToRole",
      t.assigned_to_department AS "assignedToDepartment",
      t.assigned_to_display_name AS "assignedToDisplayName",

      t.priority,
      t.status,

      t.due_at AS "dueAt",

      t.completed_at AS "completedAt",
      t.completed_by::text AS "completedBy",

      t.canceled_at AS "canceledAt",
      t.canceled_by::text AS "canceledBy",

      t.created_at AS "createdAt",
      t.created_by::text AS "createdBy",

      t.updated_at AS "updatedAt",
      t.updated_by::text AS "updatedBy",

      COALESCE(t.is_voided, false) AS "isVoided",
      t.voided_at AS "voidedAt",
      t.voided_by AS "voidedBy",
      t.void_reason AS "voidReason",

      t.metadata
    FROM inserted t
  `;
}

function eventSelectSql() {
  return `
    SELECT
      e.id,
      e.task_id::text AS "taskId",
      e.event_type AS "eventType",
      e.previous_value AS "previousValue",
      e.new_value AS "newValue",
      e.message,
      e.actor_user_id::text AS "actorUserId",
      e.actor_name AS "actorName",
      e.created_at AS "createdAt",
      e.metadata
    FROM public.platform_task_events e
  `;
}

function toPositiveInt(value: unknown, fallback: number, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function jsonParam(value: unknown) {
  return JSON.stringify(value ?? {});
}

function buildWhere(args: ListTasksArgs) {
  const params: any[] = [];
  const where: string[] = [];

  pushWhere(where, buildVoidedWhereClause("t", resolveVoidMode(args)));

  const q = String(args.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    pushWhere(
      where,
      `(
        CAST(t.task_number AS text) ILIKE ${p}
        OR COALESCE(t.task_key, '') ILIKE ${p}
        OR COALESCE(t.source_record_label, '') ILIKE ${p}
        OR COALESCE(t.title, '') ILIKE ${p}
        OR COALESCE(t.description, '') ILIKE ${p}
        OR COALESCE(t.assigned_to_display_name, '') ILIKE ${p}
      )`,
    );
  }

  if (args.visibleToUserId || args.visibleToRole || args.visibleToDepartment) {
    const parts: string[] = [];

    if (args.visibleToUserId) {
      params.push(args.visibleToUserId);
      parts.push(`t.assigned_to_user_id = $${params.length}`);
    }

    if (args.visibleToRole) {
      params.push(String(args.visibleToRole).trim().toUpperCase());
      parts.push(`UPPER(COALESCE(t.assigned_to_role, '')) = $${params.length}`);
    }

    if (args.visibleToDepartment) {
      params.push(String(args.visibleToDepartment).trim());
      parts.push(`t.assigned_to_department ILIKE $${params.length}`);
    }

    pushWhere(where, `(${parts.join(" OR ")})`);
  }

  if (args.assignedToUserId) {
    params.push(args.assignedToUserId);
    pushWhere(where, `t.assigned_to_user_id = $${params.length}`);
  }

  if (args.assignedToRole) {
    params.push(String(args.assignedToRole).trim().toUpperCase());
    pushWhere(where, `UPPER(COALESCE(t.assigned_to_role, '')) = $${params.length}`);
  }

  if (args.assignedToDepartment) {
    params.push(String(args.assignedToDepartment).trim());
    pushWhere(where, `t.assigned_to_department ILIKE $${params.length}`);
  }

  if (args.sourceModule) {
    params.push(String(args.sourceModule).trim());
    pushWhere(where, `t.source_module = $${params.length}`);
  }

  if (args.entityType) {
    params.push(String(args.entityType).trim());
    pushWhere(where, `t.entity_type = $${params.length}`);
  }

  if (args.entityId) {
    params.push(String(args.entityId).trim());
    pushWhere(where, `t.entity_id = $${params.length}`);
  }

  if (args.taskType) {
    params.push(String(args.taskType).trim());
    pushWhere(where, `t.task_type = $${params.length}`);
  }

  if (args.statuses?.length) {
    params.push(args.statuses);
    pushWhere(where, `t.status = ANY($${params.length}::text[])`);
  }

  if (args.priority) {
    params.push(args.priority);
    pushWhere(where, `t.priority = $${params.length}`);
  }

  if (args.overdue === true) {
    pushWhere(
      where,
      `t.due_at IS NOT NULL
       AND t.due_at < NOW()
       AND t.status IN ('open', 'in_progress', 'blocked')`,
    );
  }

  if (args.dueToday === true) {
    pushWhere(
      where,
      `t.due_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago'
       AND t.due_at < ((date_trunc('day', NOW() AT TIME ZONE 'America/Chicago') + interval '1 day') AT TIME ZONE 'America/Chicago')`,
    );
  }

  return {
    params,
    whereSql: joinWhere(where),
  };
}

function orderBy(args: ListTasksArgs) {
  const dir = args.sortDir === "asc" ? "ASC" : "DESC";

  const map: Record<string, string> = {
    taskNumber: `t.task_number ${dir}`,
    sourceModule: `t.source_module ${dir}`,
    taskType: `t.task_type ${dir}`,
    title: `t.title ${dir}`,
    assignedToDisplayName: `t.assigned_to_display_name ${dir}`,
    priority: `t.priority ${dir}`,
    status: `t.status ${dir}`,
    dueAt: `t.due_at ${dir} NULLS LAST`,
    createdAt: `t.created_at ${dir}`,
    updatedAt: `t.updated_at ${dir}`,
  };

  return map[args.sortBy || ""] ?? `t.due_at ASC NULLS LAST, t.created_at DESC`;
}

export async function listTasks(args: ListTasksArgs = {}): Promise<PagedTaskResult> {
  const page = toPositiveInt(args.page, 1);
  const pageSize = toPositiveInt(args.pageSize, 25);
  const offset = (page - 1) * pageSize;

  const { whereSql, params } = buildWhere(args);

  const countRes = await db.query<{ total: number }>(
    `
    SELECT COUNT(*)::int AS total
    FROM public.platform_tasks t
    ${whereSql}
    `,
    params,
  );

  const rowsRes = await db.query<PlatformTaskRow>(
    `
    ${taskSelectSql()}
    ${whereSql}
    ORDER BY ${orderBy(args)}, t.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, pageSize, offset],
  );

  return {
    rows: rowsRes.rows,
    totalCount: Number(countRes.rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getTaskById(
  id: string,
  options: StandardRepoOptions = {},
): Promise<PlatformTaskRow | null> {
  const { rows } = await db.query<PlatformTaskRow>(
    `
    ${taskSelectSql()}
    WHERE t.id = $1
      AND ${buildVoidedWhereClause("t", resolveVoidMode(options))}
    LIMIT 1
    `,
    [id],
  );

  return rows[0] ?? null;
}

export async function createTask(input: CreateTaskInput): Promise<PlatformTaskRow> {
  const { rows } = await db.query<PlatformTaskRow>(
    `
    WITH inserted AS (
      INSERT INTO public.platform_tasks (
        task_key,
        source_module,
        entity_type,
        entity_id,
        source_record_label,
        task_type,
        title,
        description,
        assigned_to_user_id,
        assigned_to_role,
        assigned_to_department,
        assigned_to_display_name,
        priority,
        status,
        due_at,
        created_by,
        updated_by,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18::jsonb
      )
      RETURNING *
    )
    ${taskSelectFromInsertedSql()}
    `,
    [
      input.taskKey ?? null,
      input.sourceModule,
      input.entityType,
      input.entityId,
      input.sourceRecordLabel ?? null,
      input.taskType,
      input.title,
      input.description ?? null,
      input.assignedToUserId ?? null,
      input.assignedToRole ?? null,
      input.assignedToDepartment ?? null,
      input.assignedToDisplayName ?? null,
      input.priority ?? "normal",
      input.status ?? "open",
      input.dueAt ?? null,
      input.createdBy ?? null,
      input.updatedBy ?? input.createdBy ?? null,
      jsonParam(input.metadata),
    ],
  );

  return rows[0]!;
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    dueAt: string | Date | null;
    metadata: unknown;
  }>,
  updatedBy?: string | null,
): Promise<PlatformTaskRow | null> {
  const existing = await getTaskById(id, { includeVoided: true });
  if (!existing) throw new Error("Task not found.");
  if (existing.isVoided) throw new Error("Voided tasks cannot be edited.");

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if ("title" in data) {
    sets.push(`title = $${idx++}`);
    params.push(data.title);
  }

  if ("description" in data) {
    sets.push(`description = $${idx++}`);
    params.push(data.description ?? null);
  }

  if ("priority" in data) {
    sets.push(`priority = $${idx++}`);
    params.push(data.priority);
  }

  if ("status" in data) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
  }

  if ("dueAt" in data) {
    sets.push(`due_at = $${idx++}`);
    params.push(data.dueAt ?? null);
  }

  if ("metadata" in data) {
    sets.push(`metadata = $${idx++}::jsonb`);
    params.push(jsonParam(data.metadata));
  }

  sets.push(`updated_at = NOW()`);

  if (updatedBy) {
    sets.push(`updated_by = $${idx++}`);
    params.push(updatedBy);
  }

  if (!sets.length) return existing;

  params.push(id);

  const { rows } = await db.query<PlatformTaskRow>(
    `
    WITH updated AS (
      UPDATE public.platform_tasks
      SET ${sets.join(", ")}
      WHERE id = $${idx}
        AND COALESCE(is_voided, false) = false
      RETURNING *
    )
    SELECT
      t.id::text AS "id",
      t.task_number AS "taskNumber",
      t.task_key AS "taskKey",
      t.source_module AS "sourceModule",
      t.entity_type AS "entityType",
      t.entity_id AS "entityId",
      t.source_record_label AS "sourceRecordLabel",
      t.task_type AS "taskType",
      t.title,
      t.description,
      t.assigned_to_user_id::text AS "assignedToUserId",
      t.assigned_to_role AS "assignedToRole",
      t.assigned_to_department AS "assignedToDepartment",
      t.assigned_to_display_name AS "assignedToDisplayName",
      t.priority,
      t.status,
      t.due_at AS "dueAt",
      t.completed_at AS "completedAt",
      t.completed_by::text AS "completedBy",
      t.canceled_at AS "canceledAt",
      t.canceled_by::text AS "canceledBy",
      t.created_at AS "createdAt",
      t.created_by::text AS "createdBy",
      t.updated_at AS "updatedAt",
      t.updated_by::text AS "updatedBy",
      COALESCE(t.is_voided, false) AS "isVoided",
      t.voided_at AS "voidedAt",
      t.voided_by AS "voidedBy",
      t.void_reason AS "voidReason",
      t.metadata
    FROM updated t
    `,
    params,
  );

  return rows[0] ?? null;
}

export async function assignTask(input: {
  id: string;
  assignedToUserId?: string | null;
  assignedToRole?: string | null;
  assignedToDepartment?: string | null;
  assignedToDisplayName?: string | null;
  updatedBy?: string | null;
}): Promise<PlatformTaskRow | null> {
  const existing = await getTaskById(input.id, { includeVoided: true });
  if (!existing) throw new Error("Task not found.");
  if (existing.isVoided) throw new Error("Voided tasks cannot be reassigned.");

  const { rows } = await db.query<PlatformTaskRow>(
    `
    WITH updated AS (
      UPDATE public.platform_tasks
      SET
        assigned_to_user_id = $2,
        assigned_to_role = $3,
        assigned_to_department = $4,
        assigned_to_display_name = $5,
        updated_at = NOW(),
        updated_by = $6
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      RETURNING *
    )
    SELECT
      t.id::text AS "id",
      t.task_number AS "taskNumber",
      t.task_key AS "taskKey",
      t.source_module AS "sourceModule",
      t.entity_type AS "entityType",
      t.entity_id AS "entityId",
      t.source_record_label AS "sourceRecordLabel",
      t.task_type AS "taskType",
      t.title,
      t.description,
      t.assigned_to_user_id::text AS "assignedToUserId",
      t.assigned_to_role AS "assignedToRole",
      t.assigned_to_department AS "assignedToDepartment",
      t.assigned_to_display_name AS "assignedToDisplayName",
      t.priority,
      t.status,
      t.due_at AS "dueAt",
      t.completed_at AS "completedAt",
      t.completed_by::text AS "completedBy",
      t.canceled_at AS "canceledAt",
      t.canceled_by::text AS "canceledBy",
      t.created_at AS "createdAt",
      t.created_by::text AS "createdBy",
      t.updated_at AS "updatedAt",
      t.updated_by::text AS "updatedBy",
      COALESCE(t.is_voided, false) AS "isVoided",
      t.voided_at AS "voidedAt",
      t.voided_by AS "voidedBy",
      t.void_reason AS "voidReason",
      t.metadata
    FROM updated t
    `,
    [
      input.id,
      input.assignedToUserId ?? null,
      input.assignedToRole ?? null,
      input.assignedToDepartment ?? null,
      input.assignedToDisplayName ?? null,
      input.updatedBy ?? null,
    ],
  );

  return rows[0] ?? null;
}

export async function setTaskStatus(input: {
  id: string;
  status: TaskStatus;
  actorUserId?: string | null;
}): Promise<PlatformTaskRow | null> {
  const existing = await getTaskById(input.id, { includeVoided: true });
  if (!existing) throw new Error("Task not found.");
  if (existing.isVoided) throw new Error("Voided tasks cannot be edited.");

  const { rows } = await db.query<PlatformTaskRow>(
    `
    WITH updated AS (
      UPDATE public.platform_tasks
      SET
        status = $2,
        completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
        completed_by = CASE WHEN $2 = 'completed' THEN $3 ELSE completed_by END,
        canceled_at = CASE WHEN $2 = 'canceled' THEN COALESCE(canceled_at, NOW()) ELSE canceled_at END,
        canceled_by = CASE WHEN $2 = 'canceled' THEN $3 ELSE canceled_by END,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      RETURNING *
    )
    SELECT
      t.id::text AS "id",
      t.task_number AS "taskNumber",
      t.task_key AS "taskKey",
      t.source_module AS "sourceModule",
      t.entity_type AS "entityType",
      t.entity_id AS "entityId",
      t.source_record_label AS "sourceRecordLabel",
      t.task_type AS "taskType",
      t.title,
      t.description,
      t.assigned_to_user_id::text AS "assignedToUserId",
      t.assigned_to_role AS "assignedToRole",
      t.assigned_to_department AS "assignedToDepartment",
      t.assigned_to_display_name AS "assignedToDisplayName",
      t.priority,
      t.status,
      t.due_at AS "dueAt",
      t.completed_at AS "completedAt",
      t.completed_by::text AS "completedBy",
      t.canceled_at AS "canceledAt",
      t.canceled_by::text AS "canceledBy",
      t.created_at AS "createdAt",
      t.created_by::text AS "createdBy",
      t.updated_at AS "updatedAt",
      t.updated_by::text AS "updatedBy",
      COALESCE(t.is_voided, false) AS "isVoided",
      t.voided_at AS "voidedAt",
      t.voided_by AS "voidedBy",
      t.void_reason AS "voidReason",
      t.metadata
    FROM updated t
    `,
    [input.id, input.status, input.actorUserId ?? null],
  );

  return rows[0] ?? null;
}

export async function voidTask(input: {
  id: string;
  actorUserId?: string | null;
  actorName?: string | null;
  reason?: string | null;
}): Promise<PlatformTaskRow | null> {
  const { rows } = await db.query<PlatformTaskRow>(
    `
    WITH updated AS (
      UPDATE public.platform_tasks
      SET
        status = 'voided',
        is_voided = true,
        voided_at = NOW(),
        voided_by = $2,
        void_reason = $3,
        updated_at = NOW(),
        updated_by = $4
      WHERE id = $1
        AND COALESCE(is_voided, false) = false
      RETURNING *
    )
    SELECT
      t.id::text AS "id",
      t.task_number AS "taskNumber",
      t.task_key AS "taskKey",
      t.source_module AS "sourceModule",
      t.entity_type AS "entityType",
      t.entity_id AS "entityId",
      t.source_record_label AS "sourceRecordLabel",
      t.task_type AS "taskType",
      t.title,
      t.description,
      t.assigned_to_user_id::text AS "assignedToUserId",
      t.assigned_to_role AS "assignedToRole",
      t.assigned_to_department AS "assignedToDepartment",
      t.assigned_to_display_name AS "assignedToDisplayName",
      t.priority,
      t.status,
      t.due_at AS "dueAt",
      t.completed_at AS "completedAt",
      t.completed_by::text AS "completedBy",
      t.canceled_at AS "canceledAt",
      t.canceled_by::text AS "canceledBy",
      t.created_at AS "createdAt",
      t.created_by::text AS "createdBy",
      t.updated_at AS "updatedAt",
      t.updated_by::text AS "updatedBy",
      COALESCE(t.is_voided, false) AS "isVoided",
      t.voided_at AS "voidedAt",
      t.voided_by AS "voidedBy",
      t.void_reason AS "voidReason",
      t.metadata
    FROM updated t
    `,
    [input.id, input.actorName ?? null, input.reason ?? null, input.actorUserId ?? null],
  );

  return rows[0] ?? null;
}

export async function createTaskEvent(input: {
  taskId: string;
  eventType: TaskEventType;
  previousValue?: unknown;
  newValue?: unknown;
  message?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  metadata?: unknown;
}): Promise<PlatformTaskEventRow> {
  const { rows } = await db.query<PlatformTaskEventRow>(
    `
    INSERT INTO public.platform_task_events (
      task_id,
      event_type,
      previous_value,
      new_value,
      message,
      actor_user_id,
      actor_name,
      metadata
    )
    VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8::jsonb)
    RETURNING
      id,
      task_id::text AS "taskId",
      event_type AS "eventType",
      previous_value AS "previousValue",
      new_value AS "newValue",
      message,
      actor_user_id::text AS "actorUserId",
      actor_name AS "actorName",
      created_at AS "createdAt",
      metadata
    `,
    [
      input.taskId,
      input.eventType,
      input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
      input.newValue === undefined ? null : JSON.stringify(input.newValue),
      input.message ?? null,
      input.actorUserId ?? null,
      input.actorName ?? null,
      jsonParam(input.metadata),
    ],
  );

  return rows[0]!;
}

export async function listTaskEvents(taskId: string): Promise<PlatformTaskEventRow[]> {
  const { rows } = await db.query<PlatformTaskEventRow>(
    `
    ${eventSelectSql()}
    WHERE e.task_id = $1
    ORDER BY e.created_at DESC, e.id DESC
    `,
    [taskId],
  );

  return rows;
}

export async function findOpenTasksForSource(input: {
  sourceModule: string;
  entityType: string;
  entityId: string;
  taskType?: string | null;
  assignedToUserId?: string | null;
}): Promise<PlatformTaskRow[]> {
  const result = await listTasks({
    sourceModule: input.sourceModule,
    entityType: input.entityType,
    entityId: input.entityId,
    taskType: input.taskType ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    statuses: ["open", "in_progress", "blocked"],
    page: 1,
    pageSize: 50,
  });

  return result.rows;
}

export async function findOpenTaskForSource(input: {
  sourceModule: string;
  entityType: string;
  entityId: string;
  taskType: string;
  assignedToUserId?: string | null;
}): Promise<PlatformTaskRow | null> {
  const rows = await findOpenTasksForSource(input);
  return rows[0] ?? null;
}