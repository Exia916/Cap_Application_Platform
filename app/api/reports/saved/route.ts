import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";
import {
  createSavedReport,
  listSavedReportsForUser,
} from "@/lib/reports/reportRepo";

export async function GET(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const rows = await listSavedReportsForUser(access.user);
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json();

    if (!body?.reportName?.trim()) {
      return NextResponse.json({ error: "Report name is required." }, { status: 400 });
    }

    const dataset = getReportDataset(body?.datasetKey);
    if (!dataset) {
      return NextResponse.json({ error: "Invalid dataset." }, { status: 400 });
    }

    const result = await createSavedReport(
      {
        reportName: body.reportName,
        description: body.description ?? null,
        datasetKey: body.datasetKey,
        visibility: body.visibility ?? "private",
        sharedRoles: body.sharedRoles ?? [],
        sharedDepartments: body.sharedDepartments ?? [],
        selectedColumns: body.selectedColumns ?? dataset.defaultColumns,
        filters: body.filters ?? {},
        sort: body.sort ?? dataset.defaultSort,
        grouping: body.grouping ?? [],
        aggregations: body.aggregations ?? [],
        visualization: body.visualization ?? "datatable",
        chartConfig: body.chartConfig ?? null,
      },
      access.user
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save report." },
      { status: 500 }
    );
  }
}