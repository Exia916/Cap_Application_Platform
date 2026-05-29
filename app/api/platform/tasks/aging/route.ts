import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveCurrentUserIdentity } from "@/lib/services/currentUserIdentityService";

export const runtime = "nodejs";

type AgingBucket =
  | "all"
  | "overdue"
  | "due_today"
  | "due_this_week"
  | "no_due_date"
  | "active_older_than_7"
  | "closed_older_than_30"
  | "closed_older_than_90"
  | "current";

type StatusGroup = "active" | "closed" | "all";

type SortKey =
  | "taskNumber"
  | "title"
  | "assignedToDisplayName"
  | "sourceModule"
  | "sourceCreatedByName"
  | "sourceBinCode"
  | "taskType"
  | "priority"
  | "status"
  | "dueAt"
  | "createdAt"
  | "updatedAt"
  | "closedAt"
  | "ageDays"
  | "daysPastDue"
  | "closedAgeDays"
  | "agingBucket";

type AgingRow = {
  id: string;
  taskNumber: number;
  sourceModule: string;
  entityType: string;
  entityId: string;
  sourceRecordLabel: string | null;
  sourceCreatedByUserId: string | null;
  sourceCreatedByName: string | null;
  sourceBinCode: string | null;
  taskType: string;
  title: string;
  assignedToUserId: string | null;
  assignedToDisplayName: string | null;
  assignedToDepartment: string | null;
  assignedToRole: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  closedAt: string | null;
  agingBucket: AgingBucket;
  ageDays: number;
  daysPastDue: number | null;
  closedAgeDays: number | null;
};

const MANAGE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOf(auth: any) {
  return String(auth?.role ?? "").trim().toUpperCase();
}

function canManageTasks(auth: any) {
  return MANAGE_ROLES.has(roleOf(auth));
}

function clean(value: unknown) {
  const s = String(value ?? "").trim();
  return s || null;
}

function toPositiveInt(value: unknown, fallback: number, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function normalizeBucket(value: unknown): AgingBucket {
  const s = String(value ?? "").trim();

  const allowed = new Set<AgingBucket>([
    "all",
    "overdue",
    "due_today",
    "due_this_week",
    "no_due_date",
    "active_older_than_7",
    "closed_older_than_30",
    "closed_older_than_90",
    "current",
  ]);

  return allowed.has(s as AgingBucket) ? (s as AgingBucket) : "all";
}

function normalizeStatusGroup(value: unknown): StatusGroup {
  const s = String(value ?? "").trim();

  if (s === "closed" || s === "all") return s;
  return "active";
}

function normalizeSortBy(value: unknown): SortKey {
  const s = String(value ?? "").trim();

  const allowed = new Set<SortKey>([
    "taskNumber",
    "title",
    "assignedToDisplayName",
    "sourceModule",
    "sourceCreatedByName",
    "sourceBinCode",
    "taskType",
    "priority",
    "status",
    "dueAt",
    "createdAt",
    "updatedAt",
    "closedAt",
    "ageDays",
    "daysPastDue",
    "closedAgeDays",
    "agingBucket",
  ]);

  return allowed.has(s as SortKey) ? (s as SortKey) : "dueAt";
}

function normalizeSortDir(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "desc" ? "desc" : "asc";
}

function orderBySql(sortBy: SortKey, sortDir: "asc" | "desc") {
  const dir = sortDir === "desc" ? "DESC" : "ASC";

  const map: Record<SortKey, string> = {
    taskNumber: `task_number ${dir}`,
    title: `title ${dir}`,
    assignedToDisplayName: `assigned_to_display_name ${dir} NULLS LAST`,
    sourceModule: `source_module ${dir}`,
    sourceCreatedByName: `source_created_by_name ${dir} NULLS LAST`,
    sourceBinCode: `source_bin_code ${dir} NULLS LAST`,
    taskType: `task_type ${dir}`,
    priority: `priority ${dir}`,
    status: `status ${dir}`,
    dueAt: `due_at ${dir} NULLS LAST`,
    createdAt: `created_at ${dir}`,
    updatedAt: `updated_at ${dir}`,
    closedAt: `closed_at ${dir} NULLS LAST`,
    ageDays: `age_days ${dir}`,
    daysPastDue: `days_past_due ${dir} NULLS LAST`,
    closedAgeDays: `closed_age_days ${dir} NULLS LAST`,
    agingBucket: `aging_bucket ${dir}`,
  };

  return map[sortBy] ?? `due_at ASC NULLS LAST`;
}

function buildFilters(input: {
  q: string | null;
  statusGroup: StatusGroup;
  agingBucket: AgingBucket;
  sourceModule: string | null;
  sourceCreatedByName: string | null;
  sourceBinCode: string | null;
  taskType: string | null;
  priority: string | null;
  assignedToUserId: string | null;
}) {
  const params: any[] = [];
  const where: string[] = [`COALESCE(t.is_voided, false) = false`];

  if (input.q) {
    params.push(`%${input.q}%`);
    const p = `$${params.length}`;

    where.push(`(
      CAST(t.task_number AS text) ILIKE ${p}
      OR COALESCE(t.source_record_label, '') ILIKE ${p}
      OR COALESCE(t.source_created_by_name, '') ILIKE ${p}
      OR COALESCE(t.source_bin_code, '') ILIKE ${p}
      OR COALESCE(t.title, '') ILIKE ${p}
      OR COALESCE(t.description, '') ILIKE ${p}
      OR COALESCE(t.assigned_to_display_name, '') ILIKE ${p}
      OR COALESCE(t.assigned_to_department, '') ILIKE ${p}
      OR COALESCE(t.assigned_to_role, '') ILIKE ${p}
    )`);
  }

  if (input.statusGroup === "active") {
    where.push(`t.status IN ('open', 'in_progress', 'blocked')`);
  }

  if (input.statusGroup === "closed") {
    where.push(`t.status IN ('completed', 'canceled')`);
  }

  if (input.sourceModule) {
    params.push(input.sourceModule);
    where.push(`t.source_module = $${params.length}`);
  }

  if (input.sourceCreatedByName) {
    params.push(`%${input.sourceCreatedByName}%`);
    where.push(`COALESCE(t.source_created_by_name, '') ILIKE $${params.length}`);
  }

  if (input.sourceBinCode) {
    params.push(`%${input.sourceBinCode}%`);
    where.push(`COALESCE(t.source_bin_code, '') ILIKE $${params.length}`);
  }

  if (input.taskType) {
    params.push(input.taskType);
    where.push(`t.task_type = $${params.length}`);
  }

  if (input.priority) {
    params.push(input.priority);
    where.push(`t.priority = $${params.length}`);
  }

  if (input.assignedToUserId) {
    params.push(input.assignedToUserId);
    where.push(`t.assigned_to_user_id = $${params.length}`);
  }

  return {
    params,
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
  };
}

function classifiedCte(whereSql: string) {
  return `
    WITH base AS (
      SELECT
        t.id::text,
        t.task_number,
        t.source_module,
        t.entity_type,
        t.entity_id,
        t.source_record_label,
        t.source_created_by_user_id::text AS source_created_by_user_id,
        t.source_created_by_name,
        t.source_bin_code,
        t.task_type,
        t.title,
        t.assigned_to_user_id::text AS assigned_to_user_id,
        t.assigned_to_display_name,
        t.assigned_to_department,
        t.assigned_to_role,
        t.priority,
        t.status,
        t.due_at,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.canceled_at,
        COALESCE(t.completed_at, t.canceled_at) AS closed_at
      FROM public.platform_tasks t
      ${whereSql}
    ),
    classified AS (
      SELECT
        b.*,

        CASE
          WHEN b.status IN ('open', 'in_progress', 'blocked')
            AND b.due_at IS NOT NULL
            AND b.due_at < NOW()
            THEN 'overdue'

          WHEN b.status IN ('open', 'in_progress', 'blocked')
            AND b.due_at >= (date_trunc('day', NOW() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago')
            AND b.due_at < ((date_trunc('day', NOW() AT TIME ZONE 'America/Chicago') + interval '1 day') AT TIME ZONE 'America/Chicago')
            THEN 'due_today'

          WHEN b.status IN ('open', 'in_progress', 'blocked')
            AND b.due_at >= ((date_trunc('day', NOW() AT TIME ZONE 'America/Chicago') + interval '1 day') AT TIME ZONE 'America/Chicago')
            AND b.due_at < ((date_trunc('day', NOW() AT TIME ZONE 'America/Chicago') + interval '8 days') AT TIME ZONE 'America/Chicago')
            THEN 'due_this_week'

          WHEN b.status IN ('open', 'in_progress', 'blocked')
            AND b.due_at IS NULL
            THEN 'no_due_date'

          WHEN b.status IN ('open', 'in_progress', 'blocked')
            AND b.created_at < NOW() - interval '7 days'
            THEN 'active_older_than_7'

          WHEN b.status IN ('completed', 'canceled')
            AND b.closed_at IS NOT NULL
            AND b.closed_at < NOW() - interval '90 days'
            THEN 'closed_older_than_90'

          WHEN b.status IN ('completed', 'canceled')
            AND b.closed_at IS NOT NULL
            AND b.closed_at < NOW() - interval '30 days'
            THEN 'closed_older_than_30'

          ELSE 'current'
        END AS aging_bucket,

        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400)
        )::int AS age_days,

        CASE
          WHEN b.due_at IS NOT NULL AND b.due_at < NOW()
          THEN GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - b.due_at)) / 86400)
          )::int
          ELSE NULL
        END AS days_past_due,

        CASE
          WHEN b.closed_at IS NOT NULL
          THEN GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - b.closed_at)) / 86400)
          )::int
          ELSE NULL
        END AS closed_age_days
      FROM base b
    )
  `;
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageTasks(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const identity = await resolveCurrentUserIdentity(auth);

  if (!identity.publicUserId) {
    return NextResponse.json(
      { error: "Authenticated user could not be resolved." },
      { status: 400 },
    );
  }

  const q = clean(req.nextUrl.searchParams.get("q"));
  const statusGroup = normalizeStatusGroup(req.nextUrl.searchParams.get("statusGroup"));
  const agingBucket = normalizeBucket(req.nextUrl.searchParams.get("agingBucket"));
  const sourceModule = clean(req.nextUrl.searchParams.get("sourceModule"));
  const sourceCreatedByName = clean(req.nextUrl.searchParams.get("sourceCreatedByName"));
  const sourceBinCode = clean(req.nextUrl.searchParams.get("sourceBinCode"));
  const taskType = clean(req.nextUrl.searchParams.get("taskType"));
  const priority = clean(req.nextUrl.searchParams.get("priority"));
  const assignedToUserId = clean(req.nextUrl.searchParams.get("assignedToUserId"));

  const page = toPositiveInt(req.nextUrl.searchParams.get("page"), 1, 9999);
  const pageSize = toPositiveInt(req.nextUrl.searchParams.get("pageSize"), 25, 250);
  const offset = (page - 1) * pageSize;

  const sortBy = normalizeSortBy(req.nextUrl.searchParams.get("sortBy"));
  const sortDir = normalizeSortDir(req.nextUrl.searchParams.get("sortDir"));

  const { whereSql, params } = buildFilters({
    q,
    statusGroup,
    agingBucket,
    sourceModule,
    sourceCreatedByName,
    sourceBinCode,
    taskType,
    priority,
    assignedToUserId,
  });

  const cte = classifiedCte(whereSql);
  const selectedBucketWhere =
    agingBucket === "all" ? "" : `WHERE aging_bucket = $${params.length + 1}`;

  const selectedBucketParams =
    agingBucket === "all" ? params : [...params, agingBucket];

  const summaryRes = await db.query<{
    agingBucket: AgingBucket;
    count: number;
  }>(
    `
    ${cte}
    SELECT
      aging_bucket AS "agingBucket",
      COUNT(*)::int AS "count"
    FROM classified
    GROUP BY aging_bucket
    ORDER BY aging_bucket ASC
    `,
    params,
  );

  const totalRes = await db.query<{ total: number }>(
    `
    ${cte}
    SELECT COUNT(*)::int AS total
    FROM classified
    ${selectedBucketWhere}
    `,
    selectedBucketParams,
  );

  const rowsRes = await db.query<AgingRow>(
    `
    ${cte}
    SELECT
      id,
      task_number AS "taskNumber",
      source_module AS "sourceModule",
      entity_type AS "entityType",
      entity_id AS "entityId",
      source_record_label AS "sourceRecordLabel",
      source_created_by_user_id AS "sourceCreatedByUserId",
      source_created_by_name AS "sourceCreatedByName",
      source_bin_code AS "sourceBinCode",
      task_type AS "taskType",
      title,
      assigned_to_user_id AS "assignedToUserId",
      assigned_to_display_name AS "assignedToDisplayName",
      assigned_to_department AS "assignedToDepartment",
      assigned_to_role AS "assignedToRole",
      priority,
      status,
      due_at AS "dueAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      completed_at AS "completedAt",
      canceled_at AS "canceledAt",
      closed_at AS "closedAt",
      aging_bucket AS "agingBucket",
      age_days AS "ageDays",
      days_past_due AS "daysPastDue",
      closed_age_days AS "closedAgeDays"
    FROM classified
    ${selectedBucketWhere}
    ORDER BY ${orderBySql(sortBy, sortDir)}, id DESC
    LIMIT $${selectedBucketParams.length + 1}
    OFFSET $${selectedBucketParams.length + 2}
    `,
    [...selectedBucketParams, pageSize, offset],
  );

  const summary = {
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
    noDueDate: 0,
    activeOlderThan7: 0,
    closedOlderThan30: 0,
    closedOlderThan90: 0,
    current: 0,
  };

  for (const row of summaryRes.rows) {
    if (row.agingBucket === "overdue") summary.overdue = row.count;
    if (row.agingBucket === "due_today") summary.dueToday = row.count;
    if (row.agingBucket === "due_this_week") summary.dueThisWeek = row.count;
    if (row.agingBucket === "no_due_date") summary.noDueDate = row.count;
    if (row.agingBucket === "active_older_than_7") summary.activeOlderThan7 = row.count;
    if (row.agingBucket === "closed_older_than_30") summary.closedOlderThan30 = row.count;
    if (row.agingBucket === "closed_older_than_90") summary.closedOlderThan90 = row.count;
    if (row.agingBucket === "current") summary.current = row.count;
  }

  return NextResponse.json({
    rows: rowsRes.rows,
    totalCount: Number(totalRes.rows[0]?.total ?? 0),
    page,
    pageSize,
    summary,
    filters: {
      q,
      statusGroup,
      agingBucket,
      sourceModule,
      sourceCreatedByName,
      sourceBinCode,
      taskType,
      priority,
      assignedToUserId,
      sortBy,
      sortDir,
    },
  });
}
