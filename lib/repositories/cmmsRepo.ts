import { db } from "@/lib/db";

const S = "cmms";

export type LookupRow = { id: number; name: string };
export type SortDir = "asc" | "desc";

function toInt(v: any): number | null {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

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

  const sql = `SELECT id::int AS id, name::text AS name FROM ${S}.${table} ORDER BY name ASC`;
  const res = await db.query(sql);
  return res.rows as LookupRow[];
}

export async function getAssets(departmentId?: number | null): Promise<LookupRow[]> {
  if (departmentId && Number.isFinite(departmentId)) {
    const sql = `
      SELECT id::int AS id, name::text AS name
      FROM ${S}.assets
      WHERE department_id = $1
      ORDER BY name ASC
    `;
    const res = await db.query(sql, [departmentId]);
    return res.rows as LookupRow[];
  }

  const res = await db.query(`SELECT id::int AS id, name::text AS name FROM ${S}.assets ORDER BY name ASC`);
  return res.rows as LookupRow[];
}

/* -------------------------------------------------------------------------- */
/* WORK ORDERS                                                                 */
/* -------------------------------------------------------------------------- */

export type WorkOrderListRow = {
  workOrderId: number;

  // ✅ raw timestamp (fixes "Invalid Date" if UI expects requestedAt)
  requestedAt: string;

  // keep existing formatted columns
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM

  // ✅ name fields (fixes UI expecting requestedByName)
  requestedByName: string;

  // keep existing alias (some UI uses "name")
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
  // repo supports from/to, but your API uses requestedFrom/requestedTo
  from?: string | null; // YYYY-MM-DD
  to?: string | null; // YYYY-MM-DD
  requestedFrom?: string | null; // YYYY-MM-DD
  requestedTo?: string | null; // YYYY-MM-DD

  sortBy?: string;
  sortDir?: SortDir;
  pageIndex?: number;
  pageSize?: number;
  filters?: Record<string, string>;
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

  // Date range filter (based on requested_at date)
  if (from) {
    where.push(`wo.requested_at::date >= $${p++}::date`);
    vals.push(from);
  }
  if (to) {
    where.push(`wo.requested_at::date <= $${p++}::date`);
    vals.push(to);
  }

  // Column filters (simple ILIKE)
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
  like("commonIssue", `ic.name`);
  like("issueDialogue", `coalesce(wo.issue_dialogue,'')`);
  like("tech", `coalesce(t.name,'')`);
  like("status", `st.name`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Whitelist sorting keys
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

      -- ✅ raw timestamp (lets UI parse reliably)
      wo.requested_at::text AS "requestedAt",

      -- existing formatted columns
      to_char(wo.requested_at::date, 'YYYY-MM-DD') AS "date",
      to_char(wo.requested_at, 'HH:MI AM') AS "time",

      -- ✅ include the key UI often expects
      coalesce(wo.requested_by_name,'')::text AS "requestedByName",

      -- keep existing alias
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

async function getOpenStatusId(): Promise<number> {
  // Find "Open" (case-insensitive) in cmms.statuses
  const res = await db.query(`SELECT id::int AS id FROM ${S}.statuses WHERE lower(name) = 'open' LIMIT 1`);
  if (res.rowCount && res.rows[0]?.id) return res.rows[0].id;

  // If missing, create it
  const ins = await db.query(`INSERT INTO ${S}.statuses(name) VALUES ('Open') RETURNING id::int AS id`);
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

  return res.rows[0] as { workOrderId: number };
}

export type WorkOrderById = {
  workOrderId: number;

  departmentId: number;
  assetId: number;
  priorityId: number;
  commonIssueId: number;

  operatorInitials: string | null;
  issueDialogue: string;

  // tech-side fields (returned but requester must not edit)
  typeId: number | null;
  techId: number | null;
  statusId: number;
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

      wo.type_id::int AS "typeId",
      wo.tech_id::int AS "techId",
      wo.status_id::int AS "statusId",
      wo.down_time_recorded::text AS "downTimeRecorded",
      wo.resolution::text AS "resolution"
    FROM ${S}.work_orders wo
    WHERE wo.work_order_id = $1
    LIMIT 1
  `;

  const res = await db.query(sql, [workOrderId]);
  if (!res.rowCount) return null;
  return res.rows[0] as WorkOrderById;
}

export async function updateWorkOrderRequesterFields(args: {
  id: number;
  departmentId: number;
  assetId: number;
  priorityId: number;
  commonIssueId: number;
  operatorInitials: string | null;
  issueDialogue: string;
}): Promise<{ workOrderId: number }> {
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

  return res.rows[0] as { workOrderId: number };
}