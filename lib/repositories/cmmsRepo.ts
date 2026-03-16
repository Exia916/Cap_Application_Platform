import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

const S = "cmms";

export type LookupRow = { id: number; name: string };
export type SortDir = "asc" | "desc";

function toInt(v: any): number | null {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function jsonComparable(v: unknown): string {
  return JSON.stringify(v ?? null);
}

function trimmedOrNull(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export type ActivityActor = {
  userId?: string | null;
  userName?: string | null;
  employeeNumber?: number | null;
};

/* -------------------------------------------------------------------------- */
/* LOOKUPS                                                                     */
/* -------------------------------------------------------------------------- */

export async function getLookup(kind: string): Promise<LookupRow[]> {
  const k = String(kind || "").toLowerCase().trim();

  const table =
    k === "departments"
      ? "departments"
      : k === "priorities"
        ? "priorities"
        : k === "issues"
          ? "issue_catalog"
          : k === "statuses"
            ? "statuses"
            : k === "techs"
              ? "techs"
              : k === "types"
                ? "wo_types"
                : null;

  if (!table) throw new Error(`Unknown lookup kind: ${kind}`);

  const sql = `
    SELECT id::int AS id, name::text AS name
    FROM ${S}.${table}
    WHERE is_active = true
    ORDER BY name ASC
  `;
  const res = await db.query(sql);
  return res.rows as LookupRow[];
}

export async function getAssets(departmentId?: number | null): Promise<LookupRow[]> {
  if (departmentId && Number.isFinite(departmentId)) {
    const sql = `
      SELECT id::int AS id, name::text AS name
      FROM ${S}.assets
      WHERE department_id = $1
        AND is_active = true
      ORDER BY name ASC
    `;
    const res = await db.query(sql, [departmentId]);
    return res.rows as LookupRow[];
  }

  const res = await db.query(`
    SELECT id::int AS id, name::text AS name
    FROM ${S}.assets
    WHERE is_active = true
    ORDER BY name ASC
  `);
  return res.rows as LookupRow[];
}

/* -------------------------------------------------------------------------- */
/* WORK ORDERS - REQUESTER LIST                                                */
/* -------------------------------------------------------------------------- */

export type WorkOrderListRow = {
  workOrderId: number;
  requestedAt: string;
  date: string;
  time: string;
  requestedByName: string;
  name: string;
  department: string;
  asset: string;
  priority: string;
  operatorInitials: string | null;
  commonIssue: string;
  issueDialogue: string;
  tech: string | null;
  status: string;
};

export async function listWorkOrdersPaged(args: {
  from?: string | null;
  to?: string | null;
  requestedFrom?: string | null;
  requestedTo?: string | null;
  sortBy?: string;
  sortDir?: SortDir;
  pageIndex?: number;
  pageSize?: number;
  filters?: Record<string, string>;
  excludeResolved?: boolean;
}): Promise<{ rows: WorkOrderListRow[]; totalCount: number }> {
  const pageIndex = Math.max(0, toInt(args.pageIndex) ?? 0);
  const pageSize = Math.min(200, Math.max(1, toInt(args.pageSize) ?? 25));
  const offset = pageIndex * pageSize;

  const sortBy = String(args.sortBy || "date");
  const sortDir: SortDir = args.sortDir === "desc" ? "desc" : "asc";

  const filters = args.filters || {};

  const where: string[] = [];
  const vals: any[] = [];
  let p = 1;

  const from = args.from ?? args.requestedFrom ?? null;
  const to = args.to ?? args.requestedTo ?? null;

  if (from) {
    where.push(`wo.requested_at::date >= $${p++}::date`);
    vals.push(from);
  }
  if (to) {
    where.push(`wo.requested_at::date <= $${p++}::date`);
    vals.push(to);
  }

  if (args.excludeResolved) {
    where.push(`lower(coalesce(st.name, '')) <> 'resolved'`);
  }

  const like = (key: string, sqlExpr: string) => {
    const v = String(filters[key] ?? "").trim();
    if (!v) return;
    where.push(`${sqlExpr} ILIKE $${p++}`);
    vals.push(`%${v}%`);
  };

  like("workOrderId", `wo.work_order_id::text`);
  like("name", `coalesce(wo.requested_by_name,'')`);
  like("requestedByName", `coalesce(wo.requested_by_name,'')`);
  like("department", `d.name`);
  like("asset", `a.name`);
  like("priority", `pr.name`);
  like("opInit", `coalesce(wo.operator_initials,'')`);
  like("operatorInitials", `coalesce(wo.operator_initials,'')`);
  like("commonIssue", `ic.name`);
  like("issueDialogue", `coalesce(wo.issue_dialogue,'')`);
  like("tech", `coalesce(t.name,'')`);
  like("status", `st.name`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sortExpr =
    sortBy === "workOrderId"
      ? "wo.work_order_id"
      : sortBy === "date" || sortBy === "requestedAt" || sortBy === "requested_at"
        ? "wo.requested_at"
        : sortBy === "name" || sortBy === "requestedByName"
          ? "wo.requested_by_name"
          : sortBy === "department"
            ? "d.name"
            : sortBy === "asset"
              ? "a.name"
              : sortBy === "priority"
                ? "pr.name"
                : sortBy === "commonIssue"
                  ? "ic.name"
                  : sortBy === "status"
                    ? "st.name"
                    : "wo.requested_at";

  const countSql = `
    SELECT count(*)::int AS c
    FROM ${S}.work_orders wo
    JOIN ${S}.departments d ON d.id = wo.department_id
    JOIN ${S}.assets a ON a.id = wo.asset_id
    JOIN ${S}.priorities pr ON pr.id = wo.priority_id
    JOIN ${S}.issue_catalog ic ON ic.id = wo.common_issue_id
    JOIN ${S}.statuses st ON st.id = wo.status_id
    LEFT JOIN ${S}.techs t ON t.id = wo.tech_id
    ${whereSql}
  `;

  const dataSql = `
    SELECT
      wo.work_order_id::int AS "workOrderId",
      wo.requested_at::text AS "requestedAt",

      to_char(wo.requested_at::date, 'YYYY-MM-DD') AS "date",
      to_char(wo.requested_at, 'HH:MI AM') AS "time",

      coalesce(wo.requested_by_name,'')::text AS "requestedByName",
      coalesce(wo.requested_by_name,'')::text AS "name",

      d.name::text AS "department",
      a.name::text AS "asset",
      pr.name::text AS "priority",
      wo.operator_initials::text AS "operatorInitials",
      ic.name::text AS "commonIssue",
      wo.issue_dialogue::text AS "issueDialogue",
      t.name::text AS "tech",
      st.name::text AS "status"
    FROM ${S}.work_orders wo
    JOIN ${S}.departments d ON d.id = wo.department_id
    JOIN ${S}.assets a ON a.id = wo.asset_id
    JOIN ${S}.priorities pr ON pr.id = wo.priority_id
    JOIN ${S}.issue_catalog ic ON ic.id = wo.common_issue_id
    JOIN ${S}.statuses st ON st.id = wo.status_id
    LEFT JOIN ${S}.techs t ON t.id = wo.tech_id
    ${whereSql}
    ORDER BY ${sortExpr} ${sortDir === "desc" ? "DESC" : "ASC"}, wo.work_order_id DESC
    LIMIT $${p++} OFFSET $${p++}
  `;

  const countRes = await db.query(countSql, vals);
  vals.push(pageSize, offset);
  const dataRes = await db.query(dataSql, vals);

  return { rows: dataRes.rows as WorkOrderListRow[], totalCount: countRes.rows[0]?.c ?? 0 };
}

/* -------------------------------------------------------------------------- */
/* WORK ORDERS - CREATE                                                        */
/* -------------------------------------------------------------------------- */

async function getOpenStatusId(): Promise<number> {
  const res = await db.query(`
    SELECT id::int AS id
    FROM ${S}.statuses
    WHERE lower(name) = 'open'
      AND is_active = true
    LIMIT 1
  `);
  if (res.rowCount && res.rows[0]?.id) return res.rows[0].id;

  const inactive = await db.query(`
    SELECT id::int AS id
    FROM ${S}.statuses
    WHERE lower(name) = 'open'
    LIMIT 1
  `);
  if (inactive.rowCount && inactive.rows[0]?.id) {
    const reactivated = await db.query(
      `
      UPDATE ${S}.statuses
      SET is_active = true
      WHERE id = $1
      RETURNING id::int AS id
    `,
      [inactive.rows[0].id]
    );
    return reactivated.rows[0].id;
  }

  const ins = await db.query(`
    INSERT INTO ${S}.statuses(name, is_active)
    VALUES ('Open', true)
    RETURNING id::int AS id
  `);
  return ins.rows[0].id;
}

export async function createWorkOrder(args: {
  requestedByUserId: string | null;
  requestedByName: string;
  departmentId: number;
  assetId: number;
  priorityId: number;
  operatorInitials: string | null;
  commonIssueId: number;
  issueDialogue: string;
  activityActor?: ActivityActor | null;
}): Promise<{ workOrderId: number }> {
  const statusId = await getOpenStatusId();

  const sql = `
    INSERT INTO ${S}.work_orders (
      requested_at,
      requested_by_user_id,
      requested_by_name,
      department_id,
      asset_id,
      priority_id,
      operator_initials,
      common_issue_id,
      issue_dialogue,
      status_id
    )
    VALUES (
      now(),
      $1,
      $2,
      $3,
      $4,
      $5,
      nullif($6,''),
      $7,
      $8,
      $9
    )
    RETURNING work_order_id::int AS "workOrderId"
  `;

  const res = await db.query(sql, [
    args.requestedByUserId,
    args.requestedByName,
    args.departmentId,
    args.assetId,
    args.priorityId,
    args.operatorInitials ?? "",
    args.commonIssueId,
    args.issueDialogue,
    statusId,
  ]);

  const out = res.rows[0] as { workOrderId: number };

  try {
    const snapshot = await getWorkOrderHistorySnapshot(out.workOrderId);
    if (snapshot) {
      await logCmmsWorkOrderCreated(snapshot, args.activityActor ?? null);
    }
  } catch {
    // do not block create if activity logging fails
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* WORK ORDERS - GET BY ID (Requester + Tech)                                  */
/* -------------------------------------------------------------------------- */

export type WorkOrderById = {
  workOrderId: number;
  departmentId: number;
  assetId: number;
  priorityId: number;
  commonIssueId: number;
  operatorInitials: string | null;
  issueDialogue: string;
  requestedAt: string;
  requestedByUserId: string | null;
  requestedByName: string;
  department: string;
  asset: string;
  priority: string;
  commonIssue: string;
  typeId: number | null;
  techId: number | null;
  statusId: number;
  workOrderType: string | null;
  tech: string | null;
  status: string | null;
  downTimeRecorded: string | null;
  resolution: string | null;
};

export async function getWorkOrderById(workOrderId: number): Promise<WorkOrderById | null> {
  const sql = `
    SELECT
      wo.work_order_id::int AS "workOrderId",

      wo.department_id::int AS "departmentId",
      wo.asset_id::int AS "assetId",
      wo.priority_id::int AS "priorityId",
      wo.common_issue_id::int AS "commonIssueId",

      wo.operator_initials::text AS "operatorInitials",
      wo.issue_dialogue::text AS "issueDialogue",

      wo.requested_at::text AS "requestedAt",
      wo.requested_by_user_id::text AS "requestedByUserId",
      coalesce(wo.requested_by_name,'')::text AS "requestedByName",

      d.name::text AS "department",
      a.name::text AS "asset",
      pr.name::text AS "priority",
      ic.name::text AS "commonIssue",

      wo.type_id::int AS "typeId",
      wo.tech_id::int AS "techId",
      wo.status_id::int AS "statusId",

      wt.name::text AS "workOrderType",
      t.name::text AS "tech",
      st.name::text AS "status",

      wo.down_time_recorded::text AS "downTimeRecorded",
      wo.resolution::text AS "resolution"
    FROM ${S}.work_orders wo
    JOIN ${S}.departments d ON d.id = wo.department_id
    JOIN ${S}.assets a ON a.id = wo.asset_id
    JOIN ${S}.priorities pr ON pr.id = wo.priority_id
    JOIN ${S}.issue_catalog ic ON ic.id = wo.common_issue_id
    LEFT JOIN ${S}.wo_types wt ON wt.id = wo.type_id
    LEFT JOIN ${S}.techs t ON t.id = wo.tech_id
    JOIN ${S}.statuses st ON st.id = wo.status_id
    WHERE wo.work_order_id = $1
    LIMIT 1
  `;

  const res = await db.query(sql, [workOrderId]);
  if (!res.rowCount) return null;
  return res.rows[0] as WorkOrderById;
}

/* -------------------------------------------------------------------------- */
/* WORK ORDERS - ACTIVITY HISTORY HELPERS                                      */
/* -------------------------------------------------------------------------- */

export type WorkOrderHistorySnapshot = {
  workOrderId: number;
  requestedAt: string;
  requestedByUserId: string | null;
  requestedByName: string;
  departmentId: number;
  department: string;
  assetId: number;
  asset: string;
  priorityId: number;
  priority: string;
  operatorInitials: string | null;
  typeId: number | null;
  type: string | null;
  techId: number | null;
  tech: string | null;
  commonIssueId: number;
  commonIssue: string;
  issueDialogue: string;
  statusId: number;
  status: string;
  resolution: string | null;
  downTimeRecorded: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getWorkOrderHistorySnapshot(
  workOrderId: number
): Promise<WorkOrderHistorySnapshot | null> {
  const { rows } = await db.query(
    `
      SELECT
        w.work_order_id::int AS "workOrderId",
        w.requested_at::text AS "requestedAt",
        w.requested_by_user_id::text AS "requestedByUserId",
        coalesce(w.requested_by_name,'')::text AS "requestedByName",
        w.department_id::int AS "departmentId",
        d.name::text AS "department",
        w.asset_id::int AS "assetId",
        a.name::text AS "asset",
        w.priority_id::int AS "priorityId",
        p.name::text AS "priority",
        w.operator_initials::text AS "operatorInitials",
        w.type_id::int AS "typeId",
        wt.name::text AS "type",
        w.tech_id::int AS "techId",
        tech.name::text AS "tech",
        w.common_issue_id::int AS "commonIssueId",
        i.name::text AS "commonIssue",
        w.issue_dialogue::text AS "issueDialogue",
        w.status_id::int AS "statusId",
        s.name::text AS "status",
        w.resolution::text AS "resolution",
        w.down_time_recorded::text AS "downTimeRecorded",
        w.created_at::text AS "createdAt",
        w.updated_at::text AS "updatedAt"
      FROM ${S}.work_orders w
      JOIN ${S}.departments d ON d.id = w.department_id
      JOIN ${S}.assets a ON a.id = w.asset_id
      JOIN ${S}.priorities p ON p.id = w.priority_id
      JOIN ${S}.issue_catalog i ON i.id = w.common_issue_id
      JOIN ${S}.statuses s ON s.id = w.status_id
      LEFT JOIN ${S}.wo_types wt ON wt.id = w.type_id
      LEFT JOIN ${S}.techs tech ON tech.id = w.tech_id
      WHERE w.work_order_id = $1
      LIMIT 1
    `,
    [workOrderId]
  );

  return (rows[0] as WorkOrderHistorySnapshot | undefined) ?? null;
}

function buildCmmsFieldChanges(
  before: WorkOrderHistorySnapshot,
  after: WorkOrderHistorySnapshot
): Array<{
  fieldName: string;
  before: unknown;
  after: unknown;
  message: string;
  eventType?: string;
}> {
  const changes: Array<{
    fieldName: string;
    before: unknown;
    after: unknown;
    message: string;
    eventType?: string;
  }> = [];

  const pushIfChanged = (
    fieldName: string,
    oldVal: unknown,
    newVal: unknown,
    message: string,
    eventType?: string
  ) => {
    if (jsonComparable(oldVal) !== jsonComparable(newVal)) {
      changes.push({
        fieldName,
        before: oldVal ?? null,
        after: newVal ?? null,
        message,
        eventType,
      });
    }
  };

  pushIfChanged(
    "department_id",
    before.department,
    after.department,
    `Department changed from "${before.department}" to "${after.department}".`
  );

  pushIfChanged(
    "asset_id",
    before.asset,
    after.asset,
    `Asset changed from "${before.asset}" to "${after.asset}".`
  );

  pushIfChanged(
    "priority_id",
    before.priority,
    after.priority,
    `Priority changed from "${before.priority}" to "${after.priority}".`
  );

  pushIfChanged(
    "operator_initials",
    before.operatorInitials,
    after.operatorInitials,
    `Operator initials changed from "${before.operatorInitials ?? "Blank"}" to "${after.operatorInitials ?? "Blank"}".`
  );

  pushIfChanged(
    "common_issue_id",
    before.commonIssue,
    after.commonIssue,
    `Issue changed from "${before.commonIssue}" to "${after.commonIssue}".`
  );

  pushIfChanged(
    "issue_dialogue",
    before.issueDialogue,
    after.issueDialogue,
    `Issue details were updated.`
  );

  pushIfChanged(
    "type_id",
    before.type,
    after.type,
    `Work order type changed from "${before.type ?? "Unassigned"}" to "${after.type ?? "Unassigned"}".`
  );

  pushIfChanged(
    "tech_id",
    before.tech,
    after.tech,
    `Tech changed from "${before.tech ?? "Unassigned"}" to "${after.tech ?? "Unassigned"}".`,
    "assigned"
  );

  pushIfChanged(
    "status_id",
    before.status,
    after.status,
    `Status changed from "${before.status}" to "${after.status}".`,
    "status_changed"
  );

  pushIfChanged(
    "resolution",
    before.resolution,
    after.resolution,
    `Resolution was updated.`,
    "resolution_updated"
  );

  pushIfChanged(
    "down_time_recorded",
    before.downTimeRecorded,
    after.downTimeRecorded,
    `Down time recorded was updated.`
  );

  return changes;
}

export async function logCmmsWorkOrderCreated(
  snapshot: WorkOrderHistorySnapshot,
  actor?: ActivityActor | null
): Promise<void> {
  await createActivityHistory({
    entityType: "cmms_work_order",
    entityId: String(snapshot.workOrderId),
    eventType: "created",
    message: `Work order #${snapshot.workOrderId} created for asset "${snapshot.asset}".`,
    module: "cmms",
    userId: trimmedOrNull(actor?.userId) ?? snapshot.requestedByUserId ?? null,
    userName: trimmedOrNull(actor?.userName) ?? snapshot.requestedByName ?? null,
    employeeNumber: actor?.employeeNumber ?? null,
    newValue: snapshot,
  });
}

export async function logCmmsWorkOrderUpdates(
  before: WorkOrderHistorySnapshot,
  after: WorkOrderHistorySnapshot,
  actor?: ActivityActor | null
): Promise<void> {
  const changes = buildCmmsFieldChanges(before, after);
  if (!changes.length) return;

  for (const change of changes) {
    await createActivityHistory({
      entityType: "cmms_work_order",
      entityId: String(after.workOrderId),
      eventType: change.eventType ?? "updated",
      fieldName: change.fieldName,
      previousValue: change.before,
      newValue: change.after,
      message: change.message,
      module: "cmms",
      userId: trimmedOrNull(actor?.userId) ?? null,
      userName: trimmedOrNull(actor?.userName) ?? null,
      employeeNumber: actor?.employeeNumber ?? null,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* WORK ORDERS - REQUESTER PATCH (protect tech fields)                         */
/* -------------------------------------------------------------------------- */

export async function updateWorkOrderRequesterFields(args: {
  id: number;
  departmentId: number;
  assetId: number;
  priorityId: number;
  commonIssueId: number;
  operatorInitials: string | null;
  issueDialogue: string;
  activityActor?: ActivityActor | null;
}): Promise<{ workOrderId: number }> {
  const before = await getWorkOrderHistorySnapshot(args.id);

  const sql = `
    UPDATE ${S}.work_orders
    SET
      department_id = $2,
      asset_id = $3,
      priority_id = $4,
      common_issue_id = $5,
      operator_initials = nullif($6,''),
      issue_dialogue = $7,
      updated_at = now()
    WHERE work_order_id = $1
    RETURNING work_order_id::int AS "workOrderId"
  `;

  const res = await db.query(sql, [
    args.id,
    args.departmentId,
    args.assetId,
    args.priorityId,
    args.commonIssueId,
    args.operatorInitials ?? "",
    args.issueDialogue,
  ]);

  const out = res.rows[0] as { workOrderId: number };

  try {
    const after = await getWorkOrderHistorySnapshot(out.workOrderId);
    if (before && after) {
      await logCmmsWorkOrderUpdates(before, after, args.activityActor ?? null);
    }
  } catch {
    // do not block update if activity logging fails
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* WORK ORDERS - TECH LIST + TECH PATCH                                        */
/* -------------------------------------------------------------------------- */

export type WorkOrderTechListRow = {
  workOrderId: number;
  requestedAt: string;
  requestedByName: string;
  department: string;
  asset: string;
  priority: string;
  operatorInitials: string | null;
  commonIssue: string;
  issueDialogue: string;
  type: string | null;
  tech: string | null;
  status: string;
  resolution: string | null;
  downTimeRecorded: string | null;
};

export async function listWorkOrdersTechPaged(args: {
  requestedFrom?: string | null;
  requestedTo?: string | null;
  sortBy?: string;
  sortDir?: SortDir;
  pageIndex?: number;
  pageSize?: number;
  filters?: Record<string, string>;
  excludeResolved?: boolean;
}): Promise<{ rows: WorkOrderTechListRow[]; totalCount: number }> {
  const pageIndex = Math.max(0, toInt(args.pageIndex) ?? 0);
  const pageSize = Math.min(200, Math.max(1, toInt(args.pageSize) ?? 25));
  const offset = pageIndex * pageSize;

  const sortBy = String(args.sortBy || "requestedAt");
  const sortDir: SortDir = args.sortDir === "asc" ? "asc" : "desc";
  const filters = args.filters || {};

  const where: string[] = [];
  const vals: any[] = [];
  let p = 1;

  if (args.requestedFrom) {
    where.push(`wo.requested_at::date >= $${p++}::date`);
    vals.push(args.requestedFrom);
  }
  if (args.requestedTo) {
    where.push(`wo.requested_at::date <= $${p++}::date`);
    vals.push(args.requestedTo);
  }

  if (args.excludeResolved) {
    where.push(`lower(coalesce(st.name, '')) <> 'resolved'`);
  }

  const like = (key: string, sqlExpr: string) => {
    const v = String(filters[key] ?? "").trim();
    if (!v) return;
    where.push(`${sqlExpr} ILIKE $${p++}`);
    vals.push(`%${v}%`);
  };

  like("workOrderId", `wo.work_order_id::text`);
  like("requestedByName", `coalesce(wo.requested_by_name,'')`);
  like("department", `d.name`);
  like("asset", `a.name`);
  like("priority", `pr.name`);
  like("commonIssue", `ic.name`);
  like("issueDialogue", `coalesce(wo.issue_dialogue,'')`);
  like("type", `coalesce(typ.name,'')`);
  like("tech", `coalesce(t.name,'')`);
  like("status", `st.name`);
  like("resolution", `coalesce(wo.resolution,'')`);
  like("downTimeRecorded", `coalesce(wo.down_time_recorded,'')`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sortExpr =
    sortBy === "workOrderId"
      ? "wo.work_order_id"
      : sortBy === "requestedAt"
        ? "wo.requested_at"
        : sortBy === "requestedByName"
          ? "wo.requested_by_name"
          : sortBy === "department"
            ? "d.name"
            : sortBy === "asset"
              ? "a.name"
              : sortBy === "priority"
                ? "pr.name"
                : sortBy === "status"
                  ? "st.name"
                  : "wo.requested_at";

  const countSql = `
    SELECT count(*)::int AS c
    FROM ${S}.work_orders wo
    JOIN ${S}.departments d ON d.id = wo.department_id
    JOIN ${S}.assets a ON a.id = wo.asset_id
    JOIN ${S}.priorities pr ON pr.id = wo.priority_id
    JOIN ${S}.issue_catalog ic ON ic.id = wo.common_issue_id
    JOIN ${S}.statuses st ON st.id = wo.status_id
    LEFT JOIN ${S}.techs t ON t.id = wo.tech_id
    LEFT JOIN ${S}.wo_types typ ON typ.id = wo.type_id
    ${whereSql}
  `;

  const dataSql = `
    SELECT
      wo.work_order_id::int AS "workOrderId",
      wo.requested_at::text AS "requestedAt",

      coalesce(wo.requested_by_name,'')::text AS "requestedByName",
      d.name::text AS "department",
      a.name::text AS "asset",
      pr.name::text AS "priority",

      wo.operator_initials::text AS "operatorInitials",
      ic.name::text AS "commonIssue",
      wo.issue_dialogue::text AS "issueDialogue",

      typ.name::text AS "type",
      t.name::text AS "tech",
      st.name::text AS "status",
      wo.resolution::text AS "resolution",
      wo.down_time_recorded::text AS "downTimeRecorded"
    FROM ${S}.work_orders wo
    JOIN ${S}.departments d ON d.id = wo.department_id
    JOIN ${S}.assets a ON a.id = wo.asset_id
    JOIN ${S}.priorities pr ON pr.id = wo.priority_id
    JOIN ${S}.issue_catalog ic ON ic.id = wo.common_issue_id
    JOIN ${S}.statuses st ON st.id = wo.status_id
    LEFT JOIN ${S}.techs t ON t.id = wo.tech_id
    LEFT JOIN ${S}.wo_types typ ON typ.id = wo.type_id
    ${whereSql}
    ORDER BY ${sortExpr} ${sortDir === "asc" ? "ASC" : "DESC"}, wo.work_order_id DESC
    LIMIT $${p++} OFFSET $${p++}
  `;

  const countRes = await db.query(countSql, vals);
  vals.push(pageSize, offset);
  const dataRes = await db.query(dataSql, vals);

  return { rows: dataRes.rows as WorkOrderTechListRow[], totalCount: countRes.rows[0]?.c ?? 0 };
}

export async function updateWorkOrderTechFields(args: {
  id: number;
  typeId: number | null;
  techId: number | null;
  statusId: number | null;
  resolution: string | null;
  downTimeRecorded: string | null;
  activityActor?: ActivityActor | null;
}): Promise<{ workOrderId: number }> {
  const before = await getWorkOrderHistorySnapshot(args.id);

  const sql = `
    UPDATE ${S}.work_orders
    SET
      type_id = $2,
      tech_id = $3,
      status_id = $4,
      resolution = nullif($5,''),
      down_time_recorded = nullif($6,''),
      updated_at = now()
    WHERE work_order_id = $1
    RETURNING work_order_id::int AS "workOrderId"
  `;

  const res = await db.query(sql, [
    args.id,
    args.typeId,
    args.techId,
    args.statusId,
    args.resolution ?? "",
    args.downTimeRecorded ?? "",
  ]);

  const out = res.rows[0] as { workOrderId: number };

  try {
    const after = await getWorkOrderHistorySnapshot(out.workOrderId);
    if (before && after) {
      await logCmmsWorkOrderUpdates(before, after, args.activityActor ?? null);
    }
  } catch {
    // do not block update if activity logging fails
  }

  return out;
}