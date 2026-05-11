import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import {
  archiveSavedReport,
  getSavedReportById,
  updateSavedReport,
} from "@/lib/reports/reportRepo";

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await ctx.params;
  const row = await getSavedReportById(id, access.user);

  if (!row) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  return NextResponse.json({ report: row });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  await updateSavedReport(
    id,
    {
      reportName: body.reportName,
      description: body.description ?? null,
      datasetKey: body.datasetKey,
      visibility: body.visibility ?? "private",
      sharedRoles: body.sharedRoles ?? [],
      sharedDepartments: body.sharedDepartments ?? [],
      selectedColumns: body.selectedColumns ?? [],
      filters: body.filters ?? {},
      sort: body.sort ?? null,
      grouping: body.grouping ?? [],
      aggregations: body.aggregations ?? [],
      visualization: body.visualization ?? "datatable",
      chartConfig: body.chartConfig ?? null,
    },
    access.user
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await ctx.params;
  await archiveSavedReport(id, access.user);

  return NextResponse.json({ ok: true });
}