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

export type WorkSessionAllViewRow = {
  id: string;
  moduleKey: string;
  areaCode: string;
  areaLabel: string | null;
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
  submissionCount: number;
  totalQuantity: number;
};

export type WorkSessionAllViewRelatedSubmissionRow = {
  id: string;
  sessionId: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number | null;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  knitArea: string | null;
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
  operatorName?: string;
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

export type ListWorkSessionsAllViewArgs = StandardRepoOptions & {
  moduleKey?: string;
  areaCode?: string;
  operatorName?: string;
  employeeNumber?: number;
  isOpen?: boolean;
  workDateFrom?: string;
  workDateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?:
    | "workDate"
    | "timeIn"
    | "timeOut"
    | "operatorName"
    | "employeeNumber"
    | "moduleKey"
    | "areaCode"
    | "shift"
    | "isOpen"
    | "submissionCount"
    | "totalQuantity";
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

function resolveAllViewOrderBy(
  sortBy?: ListWorkSessionsAllViewArgs["sortBy"],
  sortDir?: ListWorkSessionsAllViewArgs["sortDir"]
) {
  const dir = String(sortDir ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const map: Record<NonNullable<ListWorkSessionsAllViewArgs["sortBy"]>, string> = {
    workDate: `ws.work_date ${dir}, ws.time_in DESC, ws.id DESC`,
    timeIn: `ws.time_in ${dir}, ws.id DESC`,
    timeOut: `ws.time_out ${dir} NULLS LAST, ws.time_in DESC, ws.id DESC`,
    operatorName: `ws.operator_name ${dir}, ws.time_in DESC, ws.id DESC`,
    employeeNumber: `ws.employee_number ${dir}, ws.time_in DESC, ws.id DESC`,
    moduleKey: `ws.module_key ${dir}, ws.time_in DESC, ws.id DESC`,
    areaCode: `ws.area_code ${dir}, ws.time_in DESC, ws.id DESC`,
    shift: `ws.shift ${dir}, ws.time_in DESC, ws.id DESC`,
    isOpen: `ws.is_open ${dir}, ws.time_in DESC, ws.id DESC`,
    submissionCount: `"submissionCount" ${dir}, ws.time_in DESC, ws.id DESC`,
    totalQuantity: `"totalQuantity" ${dir}, ws.time_in DESC, ws.id DESC`,
  };

  return map[sortBy ?? "timeIn"] ?? map.timeIn;
}

function buildWhere(args: ListWorkSessionsArgs) {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("s", resolveVoidMode(args)));

  if (args.moduleKey?.trim()) {
    params.push(`%${args.moduleKey.trim()}%`);
    pushWhere(where, `COALESCE(s.module_key, '') ILIKE $${params.length}`);
  }

  if (args.areaCode?.trim()) {
    params.push(`%${args.areaCode.trim()}%`);
    pushWhere(where, `COALESCE(s.area_code, '') ILIKE $${params.length}`);
  }

  if (args.operatorName?.trim()) {
    params.push(`%${args.operatorName.trim()}%`);
    const p = `$${params.length}`;

    pushWhere(
      where,
      `
      (
        COALESCE(s.operator_name, '') ILIKE ${p}
        OR COALESCE(s.username, '') ILIKE ${p}
        OR CAST(s.employee_number AS text) ILIKE ${p}
      )
      `
    );
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

function buildAllViewWhere(args: ListWorkSessionsAllViewArgs) {
  const where: string[] = [];
  const params: any[] = [];

  pushWhere(where, buildVoidedWhereClause("ws", resolveVoidMode(args)));

  if (args.moduleKey?.trim()) {
    params.push(`%${args.moduleKey.trim()}%`);
    pushWhere(where, `COALESCE(ws.module_key, '') ILIKE $${params.length}`);
  }

  if (args.areaCode?.trim()) {
    params.push(`%${args.areaCode.trim()}%`);
    pushWhere(where, `COALESCE(ws.area_code, '') ILIKE $${params.length}`);
  }

  if (args.operatorName?.trim()) {
    params.push(`%${args.operatorName.trim()}%`);
    const p = `$${params.length}`;

    pushWhere(
      where,
      `
      (
        COALESCE(ws.operator_name, '') ILIKE ${p}
        OR COALESCE(ws.username, '') ILIKE ${p}
        OR CAST(ws.employee_number AS text) ILIKE ${p}
      )
      `
    );
  }

  if (args.employeeNumber != null) {
    params.push(args.employeeNumber);
    pushWhere(where, `ws.employee_number = $${params.length}`);
  }

  if (typeof args.isOpen === "boolean") {
    params.push(args.isOpen);
    pushWhere(where, `ws.is_open = $${params.length}`);
  }

  if (args.workDateFrom?.trim()) {
    params.push(args.workDateFrom.trim());
    pushWhere(where, `ws.work_date >= $${params.length}::date`);
  }

  if (args.workDateTo?.trim()) {
    params.push(args.workDateTo.trim());
    pushWhere(where, `ws.work_date <= $${params.length}::date`);
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
      input.notes === undefined ? current.notes : input.notes?.trim() || null;

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

export async function listWorkSessionsAllView(
  args: ListWorkSessionsAllViewArgs
): Promise<{
  rows: WorkSessionAllViewRow[];
  relatedBySessionId: Record<string, WorkSessionAllViewRelatedSubmissionRow[]>;
  totalCount: number;
  totals: {
    totalSessions: number;
    totalSubmissions: number;
    totalQuantity: number;
  };
}> {
  const { whereSql, params } = buildAllViewWhere(args);
  const orderBy = resolveAllViewOrderBy(args.sortBy, args.sortDir);
  const limit = Number.isFinite(args.limit) ? Math.max(1, Number(args.limit)) : 25;
  const offset = Number.isFinite(args.offset) ? Math.max(0, Number(args.offset)) : 0;

  const pagedParams = [...params, limit, offset];
  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;

  const rowsSql = `
    SELECT
      ws.id,
      ws.module_key AS "moduleKey",
      ws.area_code AS "areaCode",
      cfg.area_label AS "areaLabel",
      ws.work_date AS "workDate",
      ws.shift_date AS "shiftDate",
      ws.shift,
      ws.user_id AS "userId",
      ws.username,
      ws.employee_number AS "employeeNumber",
      ws.operator_name AS "operatorName",
      ws.time_in AS "timeIn",
      ws.time_out AS "timeOut",
      ws.is_open AS "isOpen",
      ws.notes,
      ws.created_at AS "createdAt",
      ws.updated_at AS "updatedAt",
      ws.created_by AS "createdBy",
      ws.updated_by AS "updatedBy",
      COALESCE(ws.is_voided, false) AS "isVoided",
      ws.voided_at AS "voidedAt",
      ws.voided_by AS "voidedBy",
      ws.void_reason AS "voidReason",
      COUNT(DISTINCT ks.id)::int AS "submissionCount",
      COALESCE(SUM(kpl.quantity), 0)::int AS "totalQuantity"
    FROM public.production_work_sessions ws
    LEFT JOIN public.production_work_area_config cfg
      ON cfg.module_key = ws.module_key
     AND cfg.area_code = ws.area_code
    LEFT JOIN public.knit_production_submissions ks
      ON ks.session_id = ws.id
     AND COALESCE(ks.is_voided, false) = false
    LEFT JOIN public.knit_production_lines kpl
      ON kpl.submission_id = ks.id
    ${whereSql}
    GROUP BY
      ws.id,
      ws.module_key,
      ws.area_code,
      cfg.area_label,
      ws.work_date,
      ws.shift_date,
      ws.shift,
      ws.user_id,
      ws.username,
      ws.employee_number,
      ws.operator_name,
      ws.time_in,
      ws.time_out,
      ws.is_open,
      ws.notes,
      ws.created_at,
      ws.updated_at,
      ws.created_by,
      ws.updated_by,
      ws.is_voided,
      ws.voided_at,
      ws.voided_by,
      ws.void_reason
    ORDER BY ${orderBy}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const countSql = `
    SELECT COUNT(*)::text AS count
    FROM public.production_work_sessions ws
    ${whereSql}
  `;

  const totalsSql = `
    SELECT
      COUNT(*)::int AS "totalSessions",
      COALESCE(SUM(x."submissionCount"), 0)::int AS "totalSubmissions",
      COALESCE(SUM(x."totalQuantity"), 0)::int AS "totalQuantity"
    FROM (
      SELECT
        ws.id,
        COUNT(DISTINCT ks.id)::int AS "submissionCount",
        COALESCE(SUM(kpl.quantity), 0)::int AS "totalQuantity"
      FROM public.production_work_sessions ws
      LEFT JOIN public.knit_production_submissions ks
        ON ks.session_id = ws.id
       AND COALESCE(ks.is_voided, false) = false
      LEFT JOIN public.knit_production_lines kpl
        ON kpl.submission_id = ks.id
      ${whereSql}
      GROUP BY ws.id
    ) x
  `;

  const [rowsRes, countRes, totalsRes] = await Promise.all([
    db.query<WorkSessionAllViewRow>(rowsSql, pagedParams),
    db.query<{ count: string }>(countSql, params),
    db.query<{
      totalSessions: number;
      totalSubmissions: number;
      totalQuantity: number;
    }>(totalsSql, params),
  ]);

  const rows = rowsRes.rows ?? [];
  const sessionIds = rows.map((row) => row.id).filter(Boolean);

  let relatedBySessionId: Record<string, WorkSessionAllViewRelatedSubmissionRow[]> = {};

  if (sessionIds.length > 0) {
    const relatedRes = await db.query<WorkSessionAllViewRelatedSubmissionRow>(
      `
      SELECT
        s.id,
        s.session_id AS "sessionId",
        s.entry_ts AS "entryTs",
        s.entry_date AS "entryDate",
        s.name,
        s.employee_number AS "employeeNumber",
        s.shift,
        s.stock_order AS "stockOrder",
        COALESCE(s.sales_order_display, s.sales_order_base) AS "salesOrder",
        s.knit_area AS "knitArea",
        s.notes,
        COALESCE(s.is_voided, false) AS "isVoided",
        COUNT(l.id)::int AS "lineCount",
        COALESCE(SUM(l.quantity), 0)::int AS "totalQuantity"
      FROM public.knit_production_submissions s
      LEFT JOIN public.knit_production_lines l
        ON l.submission_id = s.id
      WHERE s.session_id = ANY($1::uuid[])
        AND COALESCE(s.is_voided, false) = false
      GROUP BY
        s.id,
        s.session_id,
        s.entry_ts,
        s.entry_date,
        s.name,
        s.employee_number,
        s.shift,
        s.stock_order,
        s.sales_order_display,
        s.sales_order_base,
        s.knit_area,
        s.notes,
        s.is_voided
      ORDER BY s.entry_ts DESC, s.id DESC
      `,
      [sessionIds]
    );

    relatedBySessionId = relatedRes.rows.reduce<Record<string, WorkSessionAllViewRelatedSubmissionRow[]>>(
      (acc, row) => {
        const key = String(row.sessionId ?? "");
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      },
      {}
    );
  }

  return {
    rows,
    relatedBySessionId,
    totalCount: Number(countRes.rows[0]?.count ?? 0),
    totals: {
      totalSessions: Number(totalsRes.rows[0]?.totalSessions ?? 0),
      totalSubmissions: Number(totalsRes.rows[0]?.totalSubmissions ?? 0),
      totalQuantity: Number(totalsRes.rows[0]?.totalQuantity ?? 0),
    },
  };
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