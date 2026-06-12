// app/api/reports/export/pdf/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess, canUseDataset } from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";
import { buildReportPdfExport } from "@/lib/reports/reportPdfExport";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json();
    const request = body?.request;
    const dataset = getReportDataset(request?.datasetKey);

    if (!dataset) {
      return NextResponse.json({ error: "Invalid dataset." }, { status: 400 });
    }

    if (!canUseDataset({ user: access.user, allowedRoles: dataset.allowedRoles })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pdfBytes = await buildReportPdfExport(body, access.user);

    return new NextResponse(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cap-report.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to export PDF." },
      { status: 500 }
    );
  }
}