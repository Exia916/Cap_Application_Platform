import { db } from "@/lib/db";

export type LookupRow = {
  id: string;
  code?: string | null;
  label?: string | null;
  itemCode?: string | null;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type RecutRequestRow = {
  id: string;
  recutId: number;

  requestedAt: string;
  requestedDate: string;
  requestedTime: string;

  requestedByUserId: string | null;
  requestedByUsername: string | null;
  requestedByName: string;
  requestedByEmployeeNumber: number | null;

  requestedDepartment: string;

  salesOrder: string;
  designName: string;
  recutReason: string;
  detailNumber: number;
  capStyle: string;
  pieces: number;
  operator: string;
  deliverTo: string;

  supervisorApproved: boolean;
  supervisorApprovedAt: string | null;
  supervisorApprovedBy: string | null;

  warehousePrinted: boolean;
  warehousePrintedAt: string | null;
  warehousePrintedBy: string | null;

  createdAt: string;
  updatedAt: string;
};

export type CreateRecutRequestInput = {
  requestedByUserId?: string | null;
  requestedByUsername?: string | null;
  requestedByName: string;
  requestedByEmployeeNumber?: number | null;

  requestedDepartment: string;

  salesOrder: string;
  designName: string;
  recutReason: string;
  detailNumber: number;
  capStyle: string;
  pieces: number;
  operator: string;
  deliverTo: string;

  supervisorApproved?: boolean;
  supervisorApprovedAt?: Date | null;
  supervisorApprovedBy?: string | null;

  warehousePrinted?: boolean;
  warehousePrintedAt?: Date | null;
  warehousePrintedBy?: string | null;
};

export type UpdateRecutRequestInput = {
  id: string;

  requestedDepartment: string;

  salesOrder: string;
  designName: string;
  recutReason: string;
  detailNumber: number;
  capStyle: string;
  pieces: number;
  operator: string;
  deliverTo: string;

  supervisorApproved: boolean;
  supervisorApprovedAt?: Date | null;
  supervisorApprovedBy?: string | null;

  warehousePrinted: boolean;
  warehousePrintedAt?: Date | null;
  warehousePrintedBy?: string | null;
};

export type SortDir = "asc" | "desc";

export type RecutListFilters = {
  q?: string;

  recutId?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  requestedByName?: string | null;
  requestedDepartment?: string | null;
  salesOrder?: string | null;
  designName?: string | null;
  recutReason?: string | null;
  detailNumber?: string | null;
  capStyle?: string | null;
  pieces?: string | null;
  operator?: string | null;
  deliverTo?: string | null;

  supervisorApproved?: boolean | null;
  warehousePrinted?: boolean | null;

  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: SortDir;
};

export type PagedRecutResult = {
  rows: RecutRequestRow[];
  total: number;
  page: number;
  pageSize: number;
};

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function addIlikeFilter(where: string[], params: any[], columnSql: string, value: string | null | undefined) {
  const v = String(value ?? "").trim();
  if (!v) return;

  params.push(`%${v}%`);
  where.push(`${columnSql} ILIKE $${params.length}`);
}

function addTextEqualsFilter(where: string[], params: any[], columnSql: string, value: string | null | undefined) {
  const v = String(value ?? "").trim();
  if (!v) return;

  params.push(v);
  where.push(`${columnSql} = $${params.length}`);
}

function baseSelectSql() {
  return `
    SELECT
      id,
      recut_id AS "recutId",
      requested_at AS "requestedAt",
      requested_date AS "requestedDate",
      requested_time AS "requestedTime",

      requested_by_user_id AS "requestedByUserId",
      requested_by_username AS "requestedByUsername",
      requested_by_name AS "requestedByName",
      requested_by_employee_number AS "requestedByEmployeeNumber",

      requested_department AS "requestedDepartment",

      sales_order AS "salesOrder",
      design_name AS "designName",
      recut_reason AS "recutReason",
      detail_number AS "detailNumber",
      cap_style AS "capStyle",
      pieces,
      operator,
      deliver_to AS "deliverTo",

      supervisor_approved AS "supervisorApproved",
      supervisor_approved_at AS "supervisorApprovedAt",
      supervisor_approved_by AS "supervisorApprovedBy",

      warehouse_printed AS "warehousePrinted",
      warehouse_printed_at AS "warehousePrintedAt",
      warehouse_printed_by AS "warehousePrintedBy",

      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM public.recut_requests
  `;
}

function buildWhere(filters: {
  employeeNumber?: number | null;
  q?: string;

  recutId?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  requestedByName?: string | null;
  requestedDepartment?: string | null;
  salesOrder?: string | null;
  designName?: string | null;
  recutReason?: string | null;
  detailNumber?: string | null;
  capStyle?: string | null;
  pieces?: string | null;
  operator?: string | null;
  deliverTo?: string | null;

  supervisorApproved?: boolean | null;
  warehousePrinted?: boolean | null;
}) {
  const where: string[] = [];
  const params: any[] = [];

  if (filters.employeeNumber != null) {
    params.push(filters.employeeNumber);
    where.push(`requested_by_employee_number = $${params.length}`);
  }

  const q = String(filters.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`
      (
        CAST(recut_id AS text) ILIKE ${p}
        OR CAST(requested_date AS text) ILIKE ${p}
        OR CAST(requested_time AS text) ILIKE ${p}
        OR requested_by_name ILIKE ${p}
        OR requested_department ILIKE ${p}
        OR sales_order ILIKE ${p}
        OR design_name ILIKE ${p}
        OR recut_reason ILIKE ${p}
        OR CAST(detail_number AS text) ILIKE ${p}
        OR cap_style ILIKE ${p}
        OR CAST(pieces AS text) ILIKE ${p}
        OR operator ILIKE ${p}
        OR deliver_to ILIKE ${p}
      )
    `);
  }

  addIlikeFilter(where, params, `CAST(recut_id AS text)`, filters.recutId);
  addIlikeFilter(where, params, `CAST(requested_date AS text)`, filters.requestedDate);
  addIlikeFilter(where, params, `CAST(requested_time AS text)`, filters.requestedTime);
  addIlikeFilter(where, params, `requested_by_name`, filters.requestedByName);
  addIlikeFilter(where, params, `requested_department`, filters.requestedDepartment);
  addIlikeFilter(where, params, `sales_order`, filters.salesOrder);
  addIlikeFilter(where, params, `design_name`, filters.designName);
  addIlikeFilter(where, params, `recut_reason`, filters.recutReason);
  addIlikeFilter(where, params, `CAST(detail_number AS text)`, filters.detailNumber);
  addIlikeFilter(where, params, `cap_style`, filters.capStyle);
  addIlikeFilter(where, params, `CAST(pieces AS text)`, filters.pieces);
  addIlikeFilter(where, params, `operator`, filters.operator);
  addIlikeFilter(where, params, `deliver_to`, filters.deliverTo);

  if (typeof filters.supervisorApproved === "boolean") {
    params.push(filters.supervisorApproved);
    where.push(`supervisor_approved = $${params.length}`);
  }

  if (typeof filters.warehousePrinted === "boolean") {
    params.push(filters.warehousePrinted);
    where.push(`warehouse_printed = $${params.length}`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function getOrderBy(sortBy?: string, sortDir?: SortDir) {
  const dir = String(sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const map: Record<string, string> = {
    recutId: `recut_id ${dir}`,
    requestedDate: `requested_date ${dir}, requested_time ${dir}`,
    requestedTime: `requested_time ${dir}`,
    requestedByName: `requested_by_name ${dir}`,
    requestedDepartment: `requested_department ${dir}`,
    salesOrder: `sales_order ${dir}`,
    designName: `design_name ${dir}`,
    recutReason: `recut_reason ${dir}`,
    detailNumber: `detail_number ${dir}`,
    capStyle: `cap_style ${dir}`,
    pieces: `pieces ${dir}`,
    operator: `operator ${dir}`,
    deliverTo: `deliver_to ${dir}`,
    supervisorApproved: `supervisor_approved ${dir}, requested_at DESC`,
    warehousePrinted: `warehouse_printed ${dir}, requested_at DESC`,
  };

  return map[sortBy || ""] ?? `requested_at DESC, recut_id DESC`;
}

/* -------------------------------------------------------------------------- */
/* LOOKUPS                                                                     */
/* -------------------------------------------------------------------------- */

export async function listRecutReasons(): Promise<LookupRow[]> {
  const { rows } = await db.query<LookupRow>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.recut_reasons
    WHERE is_active = true
    ORDER BY sort_order ASC, label ASC
    `
  );
  return rows;
}

export async function listRecutRequestedDepartments(): Promise<LookupRow[]> {
  const { rows } = await db.query<LookupRow>(
    `
    SELECT
      id,
      code,
      label,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.recut_requested_departments
    WHERE is_active = true
    ORDER BY sort_order ASC, label ASC
    `
  );
  return rows;
}

export async function listRecutItems(): Promise<LookupRow[]> {
  const { rows } = await db.query<LookupRow>(
    `
    SELECT
      id,
      item_code AS "itemCode",
      description,
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.recut_items
    WHERE is_active = true
    ORDER BY sort_order ASC, item_code ASC
    `
  );
  return rows;
}

/* -------------------------------------------------------------------------- */
/* CREATE / READ / UPDATE                                                      */
/* -------------------------------------------------------------------------- */

export async function createRecutRequest(
  input: CreateRecutRequestInput
): Promise<{ id: string; recutId: number }> {
  const { rows } = await db.query<{ id: string; recutId: number }>(
    `
    INSERT INTO public.recut_requests (
      requested_by_user_id,
      requested_by_username,
      requested_by_name,
      requested_by_employee_number,

      requested_department,

      sales_order,
      design_name,
      recut_reason,
      detail_number,
      cap_style,
      pieces,
      operator,
      deliver_to,

      supervisor_approved,
      supervisor_approved_at,
      supervisor_approved_by,

      warehouse_printed,
      warehouse_printed_at,
      warehouse_printed_by
    )
    VALUES (
      $1, $2, $3, $4,
      $5,
      $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16,
      $17, $18, $19
    )
    RETURNING
      id,
      recut_id AS "recutId"
    `,
    [
      input.requestedByUserId ?? null,
      input.requestedByUsername ?? null,
      input.requestedByName,
      input.requestedByEmployeeNumber ?? null,

      input.requestedDepartment,

      input.salesOrder,
      input.designName,
      input.recutReason,
      input.detailNumber,
      input.capStyle,
      input.pieces,
      input.operator,
      input.deliverTo,

      input.supervisorApproved ?? false,
      input.supervisorApprovedAt ?? null,
      input.supervisorApprovedBy ?? null,

      input.warehousePrinted ?? false,
      input.warehousePrintedAt ?? null,
      input.warehousePrintedBy ?? null,
    ]
  );

  return rows[0];
}

export async function getRecutRequestById(id: string): Promise<RecutRequestRow | null> {
  const { rows } = await db.query<RecutRequestRow>(
    `
    ${baseSelectSql()}
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function updateRecutRequest(input: UpdateRecutRequestInput): Promise<void> {
  await db.query(
    `
    UPDATE public.recut_requests
    SET
      requested_department = $2,
      sales_order = $3,
      design_name = $4,
      recut_reason = $5,
      detail_number = $6,
      cap_style = $7,
      pieces = $8,
      operator = $9,
      deliver_to = $10,

      supervisor_approved = $11,
      supervisor_approved_at = $12,
      supervisor_approved_by = $13,

      warehouse_printed = $14,
      warehouse_printed_at = $15,
      warehouse_printed_by = $16
    WHERE id = $1
    `,
    [
      input.id,
      input.requestedDepartment,
      input.salesOrder,
      input.designName,
      input.recutReason,
      input.detailNumber,
      input.capStyle,
      input.pieces,
      input.operator,
      input.deliverTo,

      input.supervisorApproved,
      input.supervisorApprovedAt ?? null,
      input.supervisorApprovedBy ?? null,

      input.warehousePrinted,
      input.warehousePrintedAt ?? null,
      input.warehousePrintedBy ?? null,
    ]
  );
}

export async function canUserEditOwnRecutRequest(input: {
  id: string;
  employeeNumber: number;
}): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.recut_requests
      WHERE id = $1
        AND requested_by_employee_number = $2
        AND supervisor_approved = false
        AND warehouse_printed = false
    ) AS ok
    `,
    [input.id, input.employeeNumber]
  );

  return !!rows[0]?.ok;
}

/* -------------------------------------------------------------------------- */
/* LISTS                                                                       */
/* -------------------------------------------------------------------------- */

async function listPagedInternal(input: {
  employeeNumber?: number | null;
  q?: string;

  recutId?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  requestedByName?: string | null;
  requestedDepartment?: string | null;
  salesOrder?: string | null;
  designName?: string | null;
  recutReason?: string | null;
  detailNumber?: string | null;
  capStyle?: string | null;
  pieces?: string | null;
  operator?: string | null;
  deliverTo?: string | null;

  supervisorApproved?: boolean | null;
  warehousePrinted?: boolean | null;

  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: SortDir;
}): Promise<PagedRecutResult> {
  const page = toPositiveInt(input.page, 1);
  const pageSize = Math.min(toPositiveInt(input.pageSize, 25), 200);
  const offset = (page - 1) * pageSize;

  const { whereSql, params } = buildWhere({
    employeeNumber: input.employeeNumber,
    q: input.q,

    recutId: input.recutId ?? null,
    requestedDate: input.requestedDate ?? null,
    requestedTime: input.requestedTime ?? null,
    requestedByName: input.requestedByName ?? null,
    requestedDepartment: input.requestedDepartment ?? null,
    salesOrder: input.salesOrder ?? null,
    designName: input.designName ?? null,
    recutReason: input.recutReason ?? null,
    detailNumber: input.detailNumber ?? null,
    capStyle: input.capStyle ?? null,
    pieces: input.pieces ?? null,
    operator: input.operator ?? null,
    deliverTo: input.deliverTo ?? null,

    supervisorApproved: input.supervisorApproved ?? null,
    warehousePrinted: input.warehousePrinted ?? null,
  });

  const orderBy = getOrderBy(input.sortBy, input.sortDir);

  const countRes = await db.query<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM public.recut_requests
    ${whereSql}
    `,
    params
  );

  const rowsRes = await db.query<RecutRequestRow>(
    `
    ${baseSelectSql()}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, pageSize, offset]
  );

  return {
    rows: rowsRes.rows,
    total: Number(countRes.rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function listRecutRequestsForUserPaged(input: {
  employeeNumber: number;
  q?: string;

  recutId?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  requestedByName?: string | null;
  requestedDepartment?: string | null;
  salesOrder?: string | null;
  designName?: string | null;
  recutReason?: string | null;
  detailNumber?: string | null;
  capStyle?: string | null;
  pieces?: string | null;
  operator?: string | null;
  deliverTo?: string | null;

  supervisorApproved?: boolean | null;
  warehousePrinted?: boolean | null;

  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: SortDir;
}): Promise<PagedRecutResult> {
  return listPagedInternal({
    employeeNumber: input.employeeNumber,
    q: input.q,

    recutId: input.recutId ?? null,
    requestedDate: input.requestedDate ?? null,
    requestedTime: input.requestedTime ?? null,
    requestedByName: input.requestedByName ?? null,
    requestedDepartment: input.requestedDepartment ?? null,
    salesOrder: input.salesOrder ?? null,
    designName: input.designName ?? null,
    recutReason: input.recutReason ?? null,
    detailNumber: input.detailNumber ?? null,
    capStyle: input.capStyle ?? null,
    pieces: input.pieces ?? null,
    operator: input.operator ?? null,
    deliverTo: input.deliverTo ?? null,

    supervisorApproved: input.supervisorApproved ?? null,
    warehousePrinted: input.warehousePrinted ?? null,

    page: input.page,
    pageSize: input.pageSize,
    sortBy: input.sortBy,
    sortDir: input.sortDir,
  });
}

export async function listRecutRequestsForReviewPaged(
  input: RecutListFilters
): Promise<PagedRecutResult> {
  return listPagedInternal(input);
}

export async function listRecutRequestsForWarehousePaged(
  input: RecutListFilters
): Promise<PagedRecutResult> {
  return listPagedInternal(input);
}

/* -------------------------------------------------------------------------- */
/* WORKFLOW HELPERS                                                            */
/* -------------------------------------------------------------------------- */

export async function approveRecutRequest(input: {
  id: string;
  approvedBy: string;
}): Promise<void> {
  await db.query(
    `
    UPDATE public.recut_requests
    SET
      supervisor_approved = true,
      supervisor_approved_at = now(),
      supervisor_approved_by = $2
    WHERE id = $1
    `,
    [input.id, input.approvedBy]
  );
}

export async function markRecutRequestsPrinted(input: {
  ids: string[];
  printedBy: string;
}): Promise<void> {
  if (!input.ids.length) return;

  await db.query(
    `
    UPDATE public.recut_requests
    SET
      warehouse_printed = true,
      warehouse_printed_at = now(),
      warehouse_printed_by = $2
    WHERE id = ANY($1::uuid[])
    `,
    [input.ids, input.printedBy]
  );
}