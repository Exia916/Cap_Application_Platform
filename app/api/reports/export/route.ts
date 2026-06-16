// app/api/reports/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { runReport } from "@/lib/reports/reportRepo";
import { formatReportValueForCsv } from "@/lib/reports/reportFormatters";

export const runtime = "nodejs";

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function safeCsvFilename(value: unknown) {
  const base = String(value || "cap-report")
    .trim()
    .replace(/\.csv$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "cap-report"}.csv`;
}

export async function POST(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
    }

    const result = await runReport(
      {
        ...body,
        page: 1,
        pageSize: Math.min(Math.max(Number(body?.pageSize || 10000), 1), 10000),
      },
      access.user
    );

    const headers = result.columns.map((column) => column.label);
    const lines = [
      headers.map(csvEscape).join(","),
      ...result.rows.map((row) =>
        result.columns
          .map((column) =>
            csvEscape(formatReportValueForCsv(row[column.key], column.type))
          )
          .join(",")
      ),
    ];

    const csv = lines.join("\n");
    const filename = safeCsvFilename(body?.reportName || "cap-report");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Report CSV export error:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to export report." },
      { status: 500 }
    );
  }
}