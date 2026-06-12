// app/api/reports/saved/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { duplicateSavedReport } from "@/lib/reports/reportRepo";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { id } = await ctx.params;
    const result = await duplicateSavedReport(id, access.user);

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const message = err?.message || "Failed to duplicate report.";
    const status = message === "Report not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}