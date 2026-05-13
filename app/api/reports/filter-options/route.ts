// app/api/reports/filter-options/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";

export const runtime = "nodejs";

function normalizeRole(role?: string | null) {
  return String(role || "").trim().toUpperCase();
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

  const role = normalizeRole(access.user.role);
  if (!dataset.allowedRoles.map(normalizeRole).includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const column = dataset.columns.find((c) => c.key === columnKey);

  if (!column || !column.filterable) {
    return NextResponse.json({ error: "Invalid filter column." }, { status: 400 });
  }

  if (column.type === "date" || column.type === "datetime") {
    return NextResponse.json({ values: [] });
  }

  const params: unknown[] = [];
  const where: string[] = [
    `${column.sql} IS NOT NULL`,
    `NULLIF(TRIM(CAST(${column.sql} AS text)), '') IS NOT NULL`,
  ];

  if (q) {
    params.push(`%${q}%`);
    where.push(`CAST(${column.sql} AS text) ILIKE $${params.length}`);
  }

  const sql = `
    SELECT DISTINCT CAST(${column.sql} AS text) AS value
    FROM ${dataset.sourceSql}
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