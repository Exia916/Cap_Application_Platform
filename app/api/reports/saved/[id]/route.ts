// app/api/reports/saved/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canUseDataset,
  requireReportAccess,
} from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";
import {
  archiveSavedReport,
  getSavedReportById,
  updateSavedReport,
} from "@/lib/reports/reportRepo";
import type {
  ReportAggregation,
  ReportCalculatedColumn,
  ReportDataset,
  ReportFilterLogic,
  ReportFilterValue,
  ReportSortConfig,
  ReportVisualization,
} from "@/lib/reports/reportTypes";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeVisibility(value: unknown) {
  const visibility = String(value || "private").trim();

  if (
    visibility === "private" ||
    visibility === "role" ||
    visibility === "department" ||
    visibility === "public_internal"
  ) {
    return visibility;
  }

  return "private";
}

function normalizeFilterLogic(value: unknown): ReportFilterLogic | undefined {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "OR" || normalized === "AND"
    ? (normalized as ReportFilterLogic)
    : undefined;
}

function normalizeVisualization(value: unknown): ReportVisualization {
  const visualization = String(value || "datatable").trim();
  const allowed = new Set([
    "datatable",
    "table",
    "kpi",
    "bar",
    "line",
    "pie",
    "donut",
    "heatmap",
  ]);

  return allowed.has(visualization)
    ? (visualization as ReportVisualization)
    : "datatable";
}

function isOutputColumn(column: { filterOnly?: boolean } | undefined) {
  return !!column && !column.filterOnly;
}

function getColumn(dataset: ReportDataset, key: string) {
  return dataset.columns.find((column) => column.key === key);
}

function sanitizeSelectedColumns(dataset: ReportDataset, value: unknown) {
  const requested = asStringArray(value);
  const selected = (requested.length ? requested : dataset.defaultColumns).filter((key) =>
    isOutputColumn(getColumn(dataset, key))
  );

  return selected.length
    ? selected
    : dataset.defaultColumns.filter((key) => isOutputColumn(getColumn(dataset, key)));
}

function sanitizeFilters(dataset: ReportDataset, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, ReportFilterValue>;
  }

  const filters: Record<string, ReportFilterValue> = {};

  for (const [key, rawFilter] of Object.entries(value as Record<string, unknown>)) {
    const column = getColumn(dataset, key);
    if (!column?.filterable) continue;

    if (!rawFilter || typeof rawFilter !== "object" || Array.isArray(rawFilter)) continue;

    const filter = rawFilter as ReportFilterValue;
    if (!filter.operator) continue;

    filters[key] = filter;
  }

  return filters;
}

function sanitizeSort(dataset: ReportDataset, value: unknown): ReportSortConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const defaultColumn = getColumn(dataset, dataset.defaultSort.column);
    return isOutputColumn(defaultColumn) && defaultColumn?.sortable
      ? dataset.defaultSort
      : null;
  }

  const raw = value as Record<string, unknown>;
  const columnKey = String(raw.column || "").trim();
  const direction = String(raw.direction || "").toLowerCase() === "asc" ? "asc" : "desc";

  if (!columnKey) return null;

  const column = getColumn(dataset, columnKey);

  // Dataset columns are validated here. Calculated column aliases are generated
  // at run time, so they are allowed to pass through if the UI supplied them.
  if (column) {
    if (!isOutputColumn(column) || !column.sortable) return null;
    return { column: columnKey, direction };
  }

  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnKey)) {
    return { column: columnKey, direction };
  }

  return null;
}

function sanitizeGrouping(dataset: ReportDataset, value: unknown) {
  return asStringArray(value).filter((key) => {
    const column = getColumn(dataset, key);
    return isOutputColumn(column) && !!column?.groupable;
  });
}

function sanitizeAggregations(dataset: ReportDataset, value: unknown) {
  if (!Array.isArray(value)) return [] as ReportAggregation[];

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as ReportAggregation)
    .filter((aggregation) => {
      const column = getColumn(dataset, aggregation.column);
      if (!isOutputColumn(column)) return false;
      if (aggregation.function === "count") return true;
      return !!column?.aggregatable;
    });
}

function sanitizeCalculatedColumns(value: unknown) {
  if (!Array.isArray(value)) return [] as ReportCalculatedColumn[];

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as ReportCalculatedColumn)
    .filter((item) => String(item.label || "").trim());
}

function sanitizeChartConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  const { id } = await ctx.params;
  const row = await getSavedReportById(id, access.user);

  if (!row) {
    return jsonError("Report not found.", 404);
  }

  return NextResponse.json({ report: row });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  try {
    const { id } = await ctx.params;
    const existing = await getSavedReportById(id, access.user);

    if (!existing) {
      return jsonError("Report not found.", 404);
    }

    if (!existing.canEdit) {
      return jsonError("You do not have permission to edit this report.", 403);
    }

    const body = await req.json();

    const reportName = String(body?.reportName || "").trim();
    if (!reportName) {
      return jsonError("Report name is required.", 400);
    }

    const dataset = getReportDataset(body?.datasetKey);
    if (!dataset) {
      return jsonError("Invalid dataset.", 400);
    }

    if (!canUseDataset({ user: access.user, allowedRoles: dataset.allowedRoles })) {
      return jsonError("Forbidden", 403);
    }

    const calculatedColumns = sanitizeCalculatedColumns(body.calculatedColumns);
    const chartConfig = sanitizeChartConfig(body.chartConfig);

    const updated = await updateSavedReport(
      id,
      {
        reportName,
        description: body.description ?? null,
        datasetKey: dataset.key,
        visibility: normalizeVisibility(body.visibility),
        sharedRoles: asStringArray(body.sharedRoles),
        sharedDepartments: asStringArray(body.sharedDepartments),
        selectedColumns: sanitizeSelectedColumns(dataset, body.selectedColumns),
        filters: sanitizeFilters(dataset, body.filters),
        filterLogic: normalizeFilterLogic(body.filterLogic),
        sort: sanitizeSort(dataset, body.sort),
        grouping: sanitizeGrouping(dataset, body.grouping),
        aggregations: sanitizeAggregations(dataset, body.aggregations),
        calculatedColumns,
        visualization: normalizeVisualization(body.visualization),
        chartConfig: {
          ...(chartConfig ?? {}),
          calculatedColumns,
          filterLogic: normalizeFilterLogic(body.filterLogic),
        },
      },
      access.user
    );

    if (!updated) {
      return jsonError(
        "Report was not updated. It may have been removed or you may not have permission.",
        409
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Update saved report error:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to update report." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  const { id } = await ctx.params;
  const existing = await getSavedReportById(id, access.user);

  if (!existing) {
    return jsonError("Report not found.", 404);
  }

  if (!existing.canEdit) {
    return jsonError("You do not have permission to archive this report.", 403);
  }

  const archived = await archiveSavedReport(id, access.user);

  if (!archived) {
    return jsonError("Report was not archived. It may have already been removed.", 409);
  }

  return NextResponse.json({ ok: true });
}
