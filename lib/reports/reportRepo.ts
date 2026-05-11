// lib/reports/reportRepo.ts

import { db } from "@/lib/db";
import type { AuthUserWithLegacy } from "@/lib/auth";
import { buildReportQuery } from "./reportQueryBuilder";
import type {
  ReportRunRequest,
  ReportRunResult,
  SavedReportInput,
  SavedReportRow,
} from "./reportTypes";

function userId(user: AuthUserWithLegacy) {
  return String(user.id || user.userId || user.employeeNumber || "");
}

function userName(user: AuthUserWithLegacy) {
  return user.displayName || user.name || user.username || "Unknown";
}

/**
 * PostgreSQL jsonb columns need valid JSON strings when using pg parameters.
 * Passing plain JS arrays/objects can sometimes be interpreted incorrectly,
 * especially arrays, causing:
 *
 * invalid input syntax for type json
 */
function toJsonb(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback);
}

function toNullableJsonb(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function mapSavedReport(row: any): SavedReportRow {
  return {
    id: row.id,
    reportName: row.reportName,
    description: row.description,
    datasetKey: row.datasetKey,
    ownerUserId: row.ownerUserId,
    ownerUsername: row.ownerUsername,
    ownerName: row.ownerName,
    ownerEmployeeNumber: row.ownerEmployeeNumber,
    visibility: row.visibility,
    sharedRoles: row.sharedRoles ?? [],
    sharedDepartments: row.sharedDepartments ?? [],
    selectedColumns: row.selectedColumns ?? [],
    filters: row.filters ?? {},
    sort: row.sortConfig ?? null,
    grouping: row.grouping ?? [],
    aggregations: row.aggregations ?? [],
    visualization: row.visualization ?? "datatable",
    chartConfig: row.chartConfig ?? null,
    lastRunAt: row.lastRunAt,
    lastRunBy: row.lastRunBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function runReport(
  request: ReportRunRequest,
  user: AuthUserWithLegacy
): Promise<ReportRunResult> {
  const started = Date.now();

  const runInsert = await db.query<{ id: number }>(
    `
    INSERT INTO public.report_runs (
      saved_report_id,
      dataset_key,
      run_by_user_id,
      run_by_username,
      run_by_name,
      run_by_employee_number,
      filters,
      selected_columns,
      sort_config,
      grouping,
      aggregations,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb,
      $8::jsonb,
      $9::jsonb,
      $10::jsonb,
      $11::jsonb,
      'running'
    )
    RETURNING id
    `,
    [
      request.savedReportId ?? null,
      request.datasetKey,
      userId(user),
      user.username ?? null,
      userName(user),
      Number(user.employeeNumber ?? 0) || null,
      toJsonb(request.filters, {}),
      toJsonb(request.selectedColumns, []),
      toJsonb(request.sort, {}),
      toJsonb(request.grouping, []),
      toJsonb(request.aggregations, []),
    ]
  );

  const runId = runInsert.rows[0]?.id;

  try {
    const built = buildReportQuery(request);

    // buildReportQuery appends limit and offset as the final two params.
    // The count query uses the same WHERE/GROUP logic but not limit/offset.
    const countParams = built.params.slice(0, built.params.length - 2);

    const [countResult, rowsResult] = await Promise.all([
      db.query<{ total: number }>(built.countSql, countParams),
      db.query<Record<string, unknown>>(built.rowsSql, built.params),
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const durationMs = Date.now() - started;

    if (runId) {
      await db.query(
        `
        UPDATE public.report_runs
        SET
          row_count = $2,
          completed_at = now(),
          duration_ms = $3,
          status = 'success'
        WHERE id = $1
        `,
        [runId, total, durationMs]
      );
    }

    if (request.savedReportId) {
      await db.query(
        `
        UPDATE public.saved_reports
        SET
          last_run_at = now(),
          last_run_by = $2
        WHERE id = $1
        `,
        [request.savedReportId, userName(user)]
      );
    }

    return {
      columns: built.columns,
      rows: rowsResult.rows,
      total,
      page: built.page,
      pageSize: built.pageSize,
    };
  } catch (err: any) {
    if (runId) {
      await db.query(
        `
        UPDATE public.report_runs
        SET
          completed_at = now(),
          duration_ms = $2,
          status = 'error',
          error_message = $3
        WHERE id = $1
        `,
        [runId, Date.now() - started, err?.message || "Report failed."]
      );
    }

    throw err;
  }
}

export async function listSavedReportsForUser(
  user: AuthUserWithLegacy
): Promise<SavedReportRow[]> {
  const role = String(user.role || "").toUpperCase();
  const department = String(user.department || "");
  const uid = userId(user);

  const { rows } = await db.query<any>(
    `
    SELECT
      id,
      report_name AS "reportName",
      description,
      dataset_key AS "datasetKey",
      owner_user_id AS "ownerUserId",
      owner_username AS "ownerUsername",
      owner_name AS "ownerName",
      owner_employee_number AS "ownerEmployeeNumber",
      visibility,
      shared_roles AS "sharedRoles",
      shared_departments AS "sharedDepartments",
      selected_columns AS "selectedColumns",
      filters,
      sort_config AS "sortConfig",
      grouping,
      aggregations,
      visualization,
      chart_config AS "chartConfig",
      last_run_at AS "lastRunAt",
      last_run_by AS "lastRunBy",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM public.saved_reports
    WHERE is_archived = false
      AND (
        owner_user_id = $1
        OR visibility = 'public_internal'
        OR (visibility = 'role' AND $2 = ANY(shared_roles))
        OR (visibility = 'department' AND $3 = ANY(shared_departments))
      )
    ORDER BY updated_at DESC, report_name ASC
    `,
    [uid, role, department]
  );

  return rows.map(mapSavedReport);
}

export async function getSavedReportById(
  id: string,
  user: AuthUserWithLegacy
): Promise<SavedReportRow | null> {
  const role = String(user.role || "").toUpperCase();
  const department = String(user.department || "");
  const uid = userId(user);

  const { rows } = await db.query<any>(
    `
    SELECT
      id,
      report_name AS "reportName",
      description,
      dataset_key AS "datasetKey",
      owner_user_id AS "ownerUserId",
      owner_username AS "ownerUsername",
      owner_name AS "ownerName",
      owner_employee_number AS "ownerEmployeeNumber",
      visibility,
      shared_roles AS "sharedRoles",
      shared_departments AS "sharedDepartments",
      selected_columns AS "selectedColumns",
      filters,
      sort_config AS "sortConfig",
      grouping,
      aggregations,
      visualization,
      chart_config AS "chartConfig",
      last_run_at AS "lastRunAt",
      last_run_by AS "lastRunBy",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM public.saved_reports
    WHERE id = $1
      AND is_archived = false
      AND (
        owner_user_id = $2
        OR visibility = 'public_internal'
        OR (visibility = 'role' AND $3 = ANY(shared_roles))
        OR (visibility = 'department' AND $4 = ANY(shared_departments))
      )
    LIMIT 1
    `,
    [id, uid, role, department]
  );

  return rows[0] ? mapSavedReport(rows[0]) : null;
}

export async function createSavedReport(
  input: SavedReportInput,
  user: AuthUserWithLegacy
): Promise<{ id: string }> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.saved_reports (
      report_name,
      description,
      dataset_key,
      owner_user_id,
      owner_username,
      owner_name,
      owner_employee_number,
      visibility,
      shared_roles,
      shared_departments,
      selected_columns,
      filters,
      sort_config,
      grouping,
      aggregations,
      visualization,
      chart_config,
      created_by,
      updated_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11::jsonb,
      $12::jsonb,
      $13::jsonb,
      $14::jsonb,
      $15::jsonb,
      $16,
      $17::jsonb,
      $18,
      $18
    )
    RETURNING id
    `,
    [
      input.reportName,
      input.description ?? null,
      input.datasetKey,
      userId(user),
      user.username ?? null,
      userName(user),
      Number(user.employeeNumber ?? 0) || null,
      input.visibility,
      input.sharedRoles ?? [],
      input.sharedDepartments ?? [],
      toJsonb(input.selectedColumns, []),
      toJsonb(input.filters, {}),
      toJsonb(input.sort, {}),
      toJsonb(input.grouping, []),
      toJsonb(input.aggregations, []),
      input.visualization ?? "datatable",
      toNullableJsonb(input.chartConfig),
      userName(user),
    ]
  );

  return rows[0];
}

export async function updateSavedReport(
  id: string,
  input: SavedReportInput,
  user: AuthUserWithLegacy
): Promise<void> {
  await db.query(
    `
    UPDATE public.saved_reports
    SET
      report_name = $2,
      description = $3,
      dataset_key = $4,
      visibility = $5,
      shared_roles = $6,
      shared_departments = $7,
      selected_columns = $8::jsonb,
      filters = $9::jsonb,
      sort_config = $10::jsonb,
      grouping = $11::jsonb,
      aggregations = $12::jsonb,
      visualization = $13,
      chart_config = $14::jsonb,
      updated_at = now(),
      updated_by = $15
    WHERE id = $1
      AND (
        owner_user_id = $16
        OR $17 = 'ADMIN'
      )
    `,
    [
      id,
      input.reportName,
      input.description ?? null,
      input.datasetKey,
      input.visibility,
      input.sharedRoles ?? [],
      input.sharedDepartments ?? [],
      toJsonb(input.selectedColumns, []),
      toJsonb(input.filters, {}),
      toJsonb(input.sort, {}),
      toJsonb(input.grouping, []),
      toJsonb(input.aggregations, []),
      input.visualization ?? "datatable",
      toNullableJsonb(input.chartConfig),
      userName(user),
      userId(user),
      String(user.role || "").toUpperCase(),
    ]
  );
}

export async function archiveSavedReport(
  id: string,
  user: AuthUserWithLegacy
): Promise<void> {
  await db.query(
    `
    UPDATE public.saved_reports
    SET
      is_archived = true,
      updated_at = now(),
      updated_by = $2
    WHERE id = $1
      AND (
        owner_user_id = $3
        OR $4 = 'ADMIN'
      )
    `,
    [id, userName(user), userId(user), String(user.role || "").toUpperCase()]
  );
}