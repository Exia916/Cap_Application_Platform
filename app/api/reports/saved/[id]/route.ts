// app/api/reports/saved/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";
import {
  archiveSavedReport,
  getSavedReportById,
  updateSavedReport,
} from "@/lib/reports/reportRepo";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

    if (!body?.reportName?.trim()) {
      return jsonError("Report name is required.", 400);
    }

    const dataset = getReportDataset(body?.datasetKey);
    if (!dataset) {
      return jsonError("Invalid dataset.", 400);
    }

    const updated = await updateSavedReport(
      id,
      {
        reportName: body.reportName.trim(),
        description: body.description ?? null,
        datasetKey: body.datasetKey,
        visibility: body.visibility ?? "private",
        sharedRoles: body.sharedRoles ?? [],
        sharedDepartments: body.sharedDepartments ?? [],
        selectedColumns: body.selectedColumns ?? dataset.defaultColumns,
        filters: body.filters ?? {},
        filterLogic: body.filterLogic,
        sort: body.sort ?? dataset.defaultSort,
        grouping: body.grouping ?? [],
        aggregations: body.aggregations ?? [],
        visualization: body.visualization ?? "datatable",
        chartConfig: body.chartConfig ?? null,
      },
      access.user
    );

    if (!updated) {
      return jsonError("Report was not updated. It may have been removed or you may not have permission.", 409);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
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