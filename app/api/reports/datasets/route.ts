import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { listReportDatasetsForRole } from "@/lib/reports/reportRegistry";

export async function GET(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const datasets = listReportDatasetsForRole(access.user.role).map((dataset) => ({
    key: dataset.key,
    label: dataset.label,
    description: dataset.description,
    category: dataset.category,
    defaultColumns: dataset.defaultColumns,
    defaultSort: dataset.defaultSort,
    columns: dataset.columns.map((column) => ({
      key: column.key,
      label: column.label,
      type: column.type,
      filterable: !!column.filterable,
      sortable: !!column.sortable,
      groupable: !!column.groupable,
      aggregatable: !!column.aggregatable,
      defaultVisible: !!column.defaultVisible,
    })),
  }));

  return NextResponse.json({ datasets });
}