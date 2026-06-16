// app/api/reports/filter-options/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canUseDataset,
  requireReportAccess,
} from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";
import type { ReportColumn, ReportDataset } from "@/lib/reports/reportTypes";

export const runtime = "nodejs";

type FilterOptionSource = {
  valueSql: string;
  fromSql: string;
  whereSql: string;
};

function isOperatorRecutRateDataset(dataset: ReportDataset) {
  return dataset.key === "operatorRecutRate";
}

function buildProductionCohortOptionSource(valueSql: string): FilterOptionSource {
  return {
    valueSql,
    fromSql: "reporting.v_production_activity p",
    whereSql: `
      p.shift_date IS NOT NULL
      AND public.cap_report_normalize_key(p.operator_name) IS NOT NULL
      AND NULLIF(btrim(p.sales_order_base), '') IS NOT NULL
      AND COALESCE(p.metric_pieces, 0) > 0
    `,
  };
}

function buildOperatorRecutRateFilterOptionSource(columnKey: string) {
  switch (columnKey) {
    case "source_module":
      return buildProductionCohortOptionSource("NULLIF(btrim(p.source_module), '')");

    case "department":
      return buildProductionCohortOptionSource("NULLIF(btrim(p.department), '')");

    case "shift":
      return buildProductionCohortOptionSource("NULLIF(btrim(p.shift), '')");

    case "operator_name":
      return buildProductionCohortOptionSource("NULLIF(btrim(p.operator_name), '')");

    case "operator_match_key":
      return buildProductionCohortOptionSource(
        "public.cap_report_normalize_key(p.operator_name)"
      );

    case "sales_order_base":
      return buildProductionCohortOptionSource("NULLIF(btrim(p.sales_order_base), '')");

    case "recut_reasons":
    case "excluded_recut_reasons":
      return {
        valueSql: "NULLIF(btrim(r.recut_reason), '')",
        fromSql: "reporting.v_recut_activity_accountability r",
        whereSql: `
          COALESCE(r.is_voided, false) = false
          AND r.operator_match_key IS NOT NULL
          AND NULLIF(btrim(r.sales_order_base), '') IS NOT NULL
          AND NULLIF(btrim(r.recut_reason), '') IS NOT NULL
        `,
      };

    default:
      return null;
  }
}

function buildGenericFilterOptionSource(
  dataset: ReportDataset,
  column: ReportColumn
): FilterOptionSource {
  return {
    valueSql: column.sql,
    fromSql: dataset.sourceSql,
    whereSql: "1 = 1",
  };
}

function buildFilterOptionSource(dataset: ReportDataset, column: ReportColumn) {
  if (isOperatorRecutRateDataset(dataset)) {
    return buildOperatorRecutRateFilterOptionSource(column.key);
  }

  return buildGenericFilterOptionSource(dataset, column);
}

export async function GET(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(req.url);

  const datasetKey = searchParams.get("datasetKey") || "";
  const columnKey = searchParams.get("columnKey") || "";
  const q = (searchParams.get("q") || "").trim();

  const dataset = getReportDataset(datasetKey);

  if (!dataset) {
    return NextResponse.json({ error: "Invalid dataset." }, { status: 400 });
  }

  if (!canUseDataset({ user: access.user, allowedRoles: dataset.allowedRoles })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const column = dataset.columns.find((c) => c.key === columnKey);

  if (!column || !column.filterable) {
    return NextResponse.json({ error: "Invalid filter column." }, { status: 400 });
  }

  if (column.type === "date" || column.type === "datetime") {
    return NextResponse.json({ values: [] });
  }

  if (column.type === "boolean") {
    return NextResponse.json({ values: ["Yes", "No"] });
  }

  const source = buildFilterOptionSource(dataset, column);

  if (!source) {
    return NextResponse.json({ values: [] });
  }

  const params: unknown[] = [];
  const where: string[] = [
    source.whereSql,
    `${source.valueSql} IS NOT NULL`,
    `NULLIF(TRIM(CAST(${source.valueSql} AS text)), '') IS NOT NULL`,
  ];

  if (q) {
    params.push(`%${q}%`);
    where.push(`CAST(${source.valueSql} AS text) ILIKE $${params.length}`);
  }

  const sql = `
    SELECT DISTINCT CAST(${source.valueSql} AS text) AS value
    FROM ${source.fromSql}
    WHERE ${where.join(" AND ")}
    ORDER BY value ASC
    LIMIT 250
  `;

  try {
    const result = await db.query<{ value: string }>(sql, params);

    return NextResponse.json({
      values: result.rows
        .map((row) => String(row.value || "").trim())
        .filter(Boolean),
    });
  } catch (err: any) {
    console.error("Report filter options error:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to load filter options." },
      { status: 500 }
    );
  }
}