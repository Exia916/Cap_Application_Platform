// app/api/reports/export/pdf/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess, canUseDataset } from "@/lib/reports/reportPermissions";
import { getReportDataset } from "@/lib/reports/reportRegistry";
import { buildReportPdfExport } from "@/lib/reports/reportPdfExport";

export const runtime = "nodejs";

function safePdfFilename(value: unknown) {
  const base = String(value || "cap-report")
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "cap-report"}.pdf`;
}

export async function POST(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid PDF export request." }, { status: 400 });
    }

    const request = body?.request;

    if (!request || typeof request !== "object") {
      return NextResponse.json({ error: "Report request is required." }, { status: 400 });
    }

    const dataset = getReportDataset(request?.datasetKey);

    if (!dataset) {
      return NextResponse.json({ error: "Invalid dataset." }, { status: 400 });
    }

    if (!canUseDataset({ user: access.user, allowedRoles: dataset.allowedRoles })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pdfBytes = await buildReportPdfExport(body, access.user);
    const filename = safePdfFilename(body?.reportName || dataset.label || "cap-report");

    return new NextResponse(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Report PDF export error:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to export PDF." },
      { status: 500 }
    );
  }
}