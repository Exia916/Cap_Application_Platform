import { db } from "@/lib/db";
import { buildVoidedWhereClause, joinWhere, pushWhere } from "@/lib/repositories/_shared/repoFilters";
import { resolveVoidMode, type StandardRepoOptions } from "@/lib/repositories/_shared/repoTypes";

export type ProductionWorkAreaRow = {
  id: string;
  moduleKey: string;
  areaCode: string;
  areaLabel: string;
  sortOrder: number;
  isActive: boolean;
};

export type ProductionWorkSession = {
  id: string;
  moduleKey: string;
  areaCode: string;
  workDate: string;
  shiftDate: string | null;
  shift: string | null;
  userId: string | null;
  username: string | null;
  employeeNumber: number | null;
  operatorName: string;
  timeIn: string;
  timeOut: string | null;
  isOpen: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type RelatedKnitSubmissionRow = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  knitArea: string | null;
  sessionId: string | null;
  notes: string | null;
  isVoided: boolean;
  lineCount: number;
  totalQuantity: number;
};

export type StartWorkSessionInput = {
  moduleKey: string;
  areaCode: string;
  timeIn: Date;
  userId?: string | null;
  username?: string | null;
  employeeNumber?: number | null;
  operatorName: string;
  notes?: string | null;
  createdBy?: string | null;
};

export type CloseWorkSessionInput = {
  sessionId: string;
  timeOut: Date;
  updatedBy?: string | null;
};

export type UpdateWorkSessionInput = {
  id: string;
  areaCode?: string | null;
  timeIn?: Date | null;
  timeOut?: Date | null;
  notes?: string | null;
  userId?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
  updatedBy?: string | null;
};

export type ListWorkSessionsArgs = StandardRepoOptions & {
  moduleKey?: string;
  areaCode?: string;
  employeeNumber?: number;
  userId?: string;
  isOpen?: boolean | null;
  workDateFrom?: string;
  workDateTo?: string;
  shiftDateFrom?: string;
  shiftDateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: "timeIn" | "workDate" | "shiftDate" | "operatorName" | "areaCode" | "isOpen";
  sortDir?: "asc" | "desc";
};

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

function chicagoParts(d: Date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = dtf.formatToParts(d);
  const get = (type: string, fallback: string) =>
    parts.find((p) => p.type === type)?.value ?? fallback;

  return {
    year: get("year", "1970"),
    month: get("month", "01"),
    day: get("day", "01"),
    hour: Number(get("hour", "0")),
    minute: Number(get("minute", "0")),
    second: Number(get("second", "0")),
  };
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);

  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function deriveShiftInfo(entryTs: Date): { shift: string; shiftDate: string; workDate: string } {
  const p = chicagoParts(entryTs);
  const workDate = `${p.year}-${p.month}-${p.day}`;

  if (p.hour >= 6 && p.hour < 18) {
    return {
      shift: "Day",
      shiftDate: workDate,
      workDate,
    };
  }

  return {
    shift: "Night",
    shiftDate: p.hour < 6 ? addDaysToYmd(workDate, -1) : workDate,
    workDate,
  };
}

function sessionSelectSql() {
  return `
    SELECT
      s.id,
      s.module_key AS "moduleKey",
      s.area_code AS "areaCode",
      s.work_date AS "workDate",
      s.shift_date AS "shiftDate",
      s.shift,
      s.user_id AS "userId",
      s.username,
      s.employee_number AS "employeeNumber",
      s.operator_name AS "operatorName",
      s.time_in AS "timeIn",
      s.time_out AS "timeOut",
      s.is_open AS "isOpen",
      s.notes,
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt",
      s.created_by AS "createdBy",
      s.updated_by AS "updatedBy",
      COALESCE(s.is_voided, false) AS "isVoided",
      s.voided_at AS "voidedAt",
      s.voided_by AS "voidedBy",
      s.void_reason AS "voidReason"
    FROM public.production_work_sessions s
  `;
}

function resolveOrderBy(sortBy?: ListWorkSessionsArgs["sortBy"], sortDir?: ListWorkSessionsArgs["sortDir"]) {
  const dir = String(sortDir ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const map: Record<NonNullable<ListWorkSessionsArgs["sortBy"]>, string> = {
    timeIn: `s.time_in ${dir}, s.id DESC`,
    workDate: `s.work_date ${dir}, s.time_in DESC, s.id DESC`,
    shiftDate: `s.shift_date ${dir} NULLS LAST, s.time_in DESC, s.id DESC`,
    operatorName: `s.operator_name ${dir}, s.time_in DESC, s.id DESC`,
    areaCode: `s.area_code ${dir}, s.time_in DESC, s.id DESC`,
    isOpen: `s.is_open ${dir}, s.time_in DESC, s.id DESC`,
  };

  return map[sortBy ?? "timeIn"] ?? map.timeIn;
}

function buildWhere(args: ListWorkSessionsArgs) {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(args)));

  if (args.moduleKey?.trim()) {
    params.push(args.moduleKey.trim());
    pushWhere(where, `s.module_key = $${params.length}`);
  }

  if (args.areaCode?.trim()) {
    params.push(args.areaCode.trim());
    pushWhere(where, `s.area_code = $${params.length}`);
  }

  if (args.employeeNumber != null) {
    params.push(args.employeeNumber);
    pushWhere(where, `s.employee_number = $${params.length}`);
  }

  if (args.userId?.trim()) {
    params.push(args.userId.trim());
    pushWhere(where, `s.user_id = $${params.length}`);
  }

  if (typeof args.isOpen === "boolean") {
    params.push(args.isOpen);
    pushWhere(where, `s.is_open = $${params.length}`);
  }

  if (args.workDateFrom?.trim()) {
    params.push(args.workDateFrom.trim());
    pushWhere(where, `s.work_date >= $${params.length}::date`);
  }

  if (args.workDateTo?.trim()) {
    params.push(args.workDateTo.trim());
    pushWhere(where, `s.work_date <= $${params.length}::date`);
  }

  if (args.shiftDateFrom?.trim()) {
    params.push(args.shiftDateFrom.trim());
    pushWhere(where, `s.shift_date >= $${params.length}::date`);
  }

  if (args.shiftDateTo?.trim()) {
    params.push(args.shiftDateTo.trim());
    pushWhere(where, `s.shift_date <= $${params.length}::date`);
  }

  return {
    whereSql: joinWhere(where),
    params,
  };
}

function roleIsElevated(role?: string | null) {
  const v = String(role ?? "").trim().toUpperCase();
  return v === "ADMIN" || v === "MANAGER" || v === "SUPERVISOR";
}

export async function listAvailableWorkAreas(moduleKey: string): Promise<ProductionWorkAreaRow[]> {
  const { rows } = await db.query<ProductionWorkAreaRow>(
    `
    SELECT
      id,
      module_key AS "moduleKey",
      area_code AS "areaCode",
      area_label AS "areaLabel",
      sort_order AS "sortOrder",
      is_active AS "isActive"
    FROM public.production_work_area_config
    WHERE module_key = $1
      AND is_active = true
    ORDER BY sort_order ASC, area_label ASC, area_code ASC
    `,
    [moduleKey]
  );

  return rows;
}

export async function workAreaExists(moduleKey: string, areaCode: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.production_work_area_config
      WHERE module_key = $1
        AND area_code = $2
        AND is_active = true
    ) AS ok
    `,
    [moduleKey, areaCode]
  );

  return !!rows[0]?.ok;
}

export async function getOpenWorkSessionForUser(
  moduleKey: string,
  input: {
    userId?: string | null;
    employeeNumber?: number | null;
  }
): Promise<ProductionWorkSession | null> {
  const where: string[] = [
    `s.module_key = $1`,
    `s.is_open = true`,
    `COALESCE(s.is_voided, false) = false`,
  ];

  const params: any[] = [moduleKey];

  if (input.userId?.trim()) {
    params.push(input.userId.trim());
    where.push(`s.user_id = $${params.length}`);
  } else if (
    input.employeeNumber != null &&
    Number.isFinite(Number(input.employeeNumber))
  ) {
    params.push(Number(input.employeeNumber));
    where.push(`s.employee_number = $${params.length}`);
  } else {
    throw new Error("User identity is required to load open work sessions.");
  }

  const { rows } = await db.query<ProductionWorkSession>(
    `
    ${sessionSelectSql()}
    WHERE ${where.join(" AND ")}
    ORDER BY s.time_in DESC, s.id DESC
    LIMIT 1
    `,
    params
  );

  return rows[0] ?? null;
}

export async function getWorkSessionById(
  id: string,
  options?: StandardRepoOptions
): Promise<ProductionWorkSession | null> {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(options)));
  params.push(id);
  pushWhere(where, `s.id = $${params.length}`);

  const { rows } = await db.query<ProductionWorkSession>(
    `
    ${sessionSelectSql()}
    ${joinWhere(where)}
    LIMIT 1
    `,
    params
  );

  return rows[0] ?? null;
}

export async function listWorkSessions(args: ListWorkSessionsArgs): Promise<{
  rows: ProductionWorkSession[];
  totalCount: number;
}> {
  const { whereSql, params } = buildWhere(args);
  const orderBy = resolveOrderBy(args.sortBy, args.sortDir);
  const limit = Number.isFinite(args.limit) ? Math.max(1, Number(args.limit)) : 50;
  const offset = Number.isFinite(args.offset) ? Math.max(0, Number(args.offset)) : 0;

  const listParams = [...params, limit, offset];

  const [rowsRes, countRes] = await Promise.all([
    db.query<ProductionWorkSession>(
      `
      ${sessionSelectSql()}
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      listParams
    ),
    db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM public.production_work_sessions s
      ${whereSql}
      `,
      params
    ),
  ]);

  return {
    rows: rowsRes.rows,
    totalCount: Number(countRes.rows[0]?.count ?? 0),
  };
}

async function ensureNoOverlappingOpenSession(
  queryable: Queryable,
  input: {
    moduleKey: string;
    userId?: string | null;
    employeeNumber?: number | null;
  }
) {
  const where: string[] = [
    `module_key = $1`,
    `is_open = true`,
    `COALESCE(is_voided, false) = false`,
  ];

  const params: any[] = [input.moduleKey];

  if (input.userId?.trim()) {
    params.push(input.userId.trim());
    where.push(`user_id = $${params.length}`);
  } else if (
    input.employeeNumber != null &&
    Number.isFinite(Number(input.employeeNumber))
  ) {
    params.push(Number(input.employeeNumber));
    where.push(`employee_number = $${params.length}`);
  } else {
    throw new Error("User identity is required to validate open work sessions.");
  }

  const { rows } = await queryable.query<{ id: string }>(
    `
    SELECT id
    FROM public.production_work_sessions
    WHERE ${where.join(" AND ")}
    LIMIT 1
    `,
    params
  );

  if (rows[0]?.id) {
    throw new Error("You already have an open work session for this module.");
  }
}

export async function startWorkSession(
  input: StartWorkSessionInput
): Promise<ProductionWorkSession> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (input.employeeNumber == null || !Number.isFinite(Number(input.employeeNumber))) {
      throw new Error("Employee number is required to start a work session.");
    }

    const validArea = await workAreaExists(input.moduleKey, input.areaCode);
    if (!validArea) {
      throw new Error("Invalid or inactive work area.");
    }

    await ensureNoOverlappingOpenSession(client, {
      moduleKey: input.moduleKey,
      userId: input.userId ?? null,
      employeeNumber: Number(input.employeeNumber),
    });

    const shiftInfo = deriveShiftInfo(input.timeIn);

    const insertRes = await client.query<{ id: string }>(
      `
      INSERT INTO public.production_work_sessions (
        module_key,
        area_code,
        work_date,
        shift_date,
        shift,
        user_id,
        username,
        employee_number,
        operator_name,
        time_in,
        is_open,
        notes,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,$12)
      RETURNING id
      `,
      [
        input.moduleKey,
        input.areaCode,
        shiftInfo.workDate,
        shiftInfo.shiftDate,
        shiftInfo.shift,
        input.userId ?? null,
        input.username ?? null,
        Number(input.employeeNumber),
        input.operatorName,
        input.timeIn,
        input.notes ?? null,
        input.createdBy ?? null,
      ]
    );

    const id = insertRes.rows[0]?.id;
    if (!id) {
      throw new Error("Failed to create work session.");
    }

    await client.query("COMMIT");

    const created = await getWorkSessionById(id, { includeVoided: true });
    if (!created) {
      throw new Error("Work session created but could not be reloaded.");
    }

    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closeWorkSession(
  input: CloseWorkSessionInput
): Promise<ProductionWorkSession> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const currentRes = await client.query<{
      id: string;
      time_in: string;
      is_open: boolean;
      is_voided: boolean;
    }>(
      `
      SELECT id, time_in, is_open, COALESCE(is_voided, false) AS is_voided
      FROM public.production_work_sessions
      WHERE id = $1
      LIMIT 1
      `,
      [input.sessionId]
    );

    const current = currentRes.rows[0];
    if (!current) {
      throw new Error("Work session not found.");
    }

    if (current.is_voided) {
      throw new Error("Voided work sessions cannot be closed.");
    }

    if (!current.is_open) {
      throw new Error("Work session is already closed.");
    }

    const timeIn = new Date(current.time_in);
    if (Number.isNaN(timeIn.getTime())) {
      throw new Error("Stored session start time is invalid.");
    }

    if (!(input.timeOut instanceof Date) || Number.isNaN(input.timeOut.getTime())) {
      throw new Error("A valid close time is required.");
    }

    if (input.timeOut <= timeIn) {
      throw new Error("Time out must be after time in.");
    }

    await client.query(
      `
      UPDATE public.production_work_sessions
      SET
        time_out = $2,
        is_open = false,
        updated_at = NOW(),
        updated_by = $3
      WHERE id = $1
      `,
      [input.sessionId, input.timeOut, input.updatedBy ?? null]
    );

    await client.query("COMMIT");

    const updated = await getWorkSessionById(input.sessionId, { includeVoided: true });
    if (!updated) {
      throw new Error("Work session updated but could not be reloaded.");
    }

    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateWorkSession(
  input: UpdateWorkSessionInput
): Promise<ProductionWorkSession> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const currentRes = await client.query<{
      id: string;
      module_key: string;
      area_code: string;
      user_id: string | null;
      employee_number: number | null;
      time_in: string;
      time_out: string | null;
      notes: string | null;
      is_open: boolean;
      is_voided: boolean;
    }>(
      `
      SELECT
        id,
        module_key,
        area_code,
        user_id,
        employee_number,
        time_in,
        time_out,
        notes,
        is_open,
        COALESCE(is_voided, false) AS is_voided
      FROM public.production_work_sessions
      WHERE id = $1
      LIMIT 1
      `,
      [input.id]
    );

    const current = currentRes.rows[0];
    if (!current) {
      throw new Error("Work session not found.");
    }

    if (current.is_voided) {
      throw new Error("Voided work sessions cannot be edited.");
    }

    const elevated = roleIsElevated(input.role);
    const ownsByUserId =
      !!input.userId && !!current.user_id && String(input.userId) === String(current.user_id);
    const ownsByEmployee =
      input.employeeNumber != null &&
      current.employee_number != null &&
      Number(input.employeeNumber) === Number(current.employee_number);

    if (!elevated && !ownsByUserId && !ownsByEmployee) {
      throw new Error("You are not allowed to edit this work session.");
    }

    const nextAreaCode = input.areaCode?.trim() ? input.areaCode.trim() : current.area_code;

    if (nextAreaCode !== current.area_code) {
      const areaOk = await workAreaExists(current.module_key, nextAreaCode);
      if (!areaOk) {
        throw new Error("Invalid or inactive work area.");
      }
    }

    const nextTimeIn =
      input.timeIn instanceof Date && !Number.isNaN(input.timeIn.getTime())
        ? input.timeIn
        : new Date(current.time_in);

    if (Number.isNaN(nextTimeIn.getTime())) {
      throw new Error("A valid time in is required.");
    }

    let nextTimeOut: Date | null;
    if (input.timeOut === undefined) {
      nextTimeOut = current.time_out ? new Date(current.time_out) : null;
    } else if (input.timeOut === null) {
      nextTimeOut = null;
    } else if (input.timeOut instanceof Date && !Number.isNaN(input.timeOut.getTime())) {
      nextTimeOut = input.timeOut;
    } else {
      throw new Error("A valid time out is required.");
    }

    if (nextTimeOut && nextTimeOut <= nextTimeIn) {
      throw new Error("Time out must be after time in.");
    }

    const nextNotes =
      input.notes === undefined ? current.notes : (input.notes?.trim() || null);

    const shiftInfo = deriveShiftInfo(nextTimeIn);
    const nextIsOpen = nextTimeOut == null;

    await client.query(
      `
      UPDATE public.production_work_sessions
      SET
        area_code = $2,
        work_date = $3,
        shift_date = $4,
        shift = $5,
        time_in = $6,
        time_out = $7,
        is_open = $8,
        notes = $9,
        updated_at = NOW(),
        updated_by = $10
      WHERE id = $1
      `,
      [
        input.id,
        nextAreaCode,
        shiftInfo.workDate,
        shiftInfo.shiftDate,
        shiftInfo.shift,
        nextTimeIn,
        nextTimeOut,
        nextIsOpen,
        nextNotes,
        input.updatedBy ?? null,
      ]
    );

    await client.query("COMMIT");

    const updated = await getWorkSessionById(input.id, { includeVoided: true });
    if (!updated) {
      throw new Error("Work session updated but could not be reloaded.");
    }

    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listRelatedKnitSubmissionsForSession(
  sessionId: string
): Promise<RelatedKnitSubmissionRow[]> {
  const { rows } = await db.query<RelatedKnitSubmissionRow>(
    `
    SELECT
      s.id,
      s.entry_ts AS "entryTs",
      s.entry_date AS "entryDate",
      s.name,
      s.employee_number AS "employeeNumber",
      s.shift,
      s.stock_order AS "stockOrder",
      COALESCE(s.sales_order_display, s.sales_order_base) AS "salesOrder",
      s.sales_order_base AS "salesOrderBase",
      s.sales_order_display AS "salesOrderDisplay",
      s.knit_area AS "knitArea",
      s.session_id AS "sessionId",
      s.notes,
      COALESCE(s.is_voided, false) AS "isVoided",
      COUNT(l.id)::int AS "lineCount",
      COALESCE(SUM(l.quantity), 0)::int AS "totalQuantity"
    FROM public.knit_production_submissions s
    LEFT JOIN public.knit_production_lines l
      ON l.submission_id = s.id
    WHERE s.session_id = $1
      AND COALESCE(s.is_voided, false) = false
    GROUP BY
      s.id,
      s.entry_ts,
      s.entry_date,
      s.name,
      s.employee_number,
      s.shift,
      s.stock_order,
      s.sales_order_display,
      s.sales_order_base,
      s.knit_area,
      s.session_id,
      s.notes,
      s.is_voided
    ORDER BY s.entry_ts DESC, s.id DESC
    `,
    [sessionId]
  );

  return rows;
}

export async function validateSessionBelongsToUser(input: {
  sessionId: string;
  moduleKey: string;
  userId?: string | null;
  employeeNumber?: number | null;
  requireOpen?: boolean;
}): Promise<ProductionWorkSession | null> {
  const params: any[] = [input.sessionId, input.moduleKey];
  const where: string[] = [
    `s.id = $1`,
    `s.module_key = $2`,
    `COALESCE(s.is_voided, false) = false`,
  ];

  if (input.userId?.trim()) {
    params.push(input.userId.trim());
    where.push(`s.user_id = $${params.length}`);
  } else if (
    input.employeeNumber != null &&
    Number.isFinite(Number(input.employeeNumber))
  ) {
    params.push(Number(input.employeeNumber));
    where.push(`s.employee_number = $${params.length}`);
  } else {
    throw new Error("User identity is required to validate session ownership.");
  }

  if (input.requireOpen !== false) {
    where.push(`s.is_open = true`);
  }

  const { rows } = await db.query<ProductionWorkSession>(
    `
    ${sessionSelectSql()}
    WHERE ${where.join(" AND ")}
    LIMIT 1
    `,
    params
  );

  return rows[0] ?? null;
}