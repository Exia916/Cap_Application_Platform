import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { runReport } from "@/lib/reports/reportRepo";

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

export async function POST(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json();

    const result = await runReport(
      {
        ...body,
        page: 1,
        pageSize: Math.min(Number(body?.pageSize || 10000), 10000),
      },
      access.user
    );

    const headers = result.columns.map((c) => c.label);
    const keys = result.columns.map((c) => c.key);

    const lines = [
      headers.map(csvEscape).join(","),
      ...result.rows.map((row) => keys.map((key) => csvEscape(row[key])).join(",")),
    ];

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cap-report.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to export report." },
      { status: 500 }
    );
  }
}