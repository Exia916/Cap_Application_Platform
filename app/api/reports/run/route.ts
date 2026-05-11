import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";
import { runReport } from "@/lib/reports/reportRepo";

export async function POST(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json();

    const dataset = getReportDataset(body?.datasetKey);
    if (!dataset) {
      return NextResponse.json({ error: "Invalid dataset." }, { status: 400 });
    }

    const role = String(access.user.role || "").toUpperCase();
    if (!dataset.allowedRoles.includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await runReport(body, access.user);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to run report." },
      { status: 500 }
    );
  }
}