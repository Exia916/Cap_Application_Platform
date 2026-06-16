// app/api/reports/saved/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { duplicateSavedReport } from "@/lib/reports/reportRepo";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  try {
    const { id } = await ctx.params;

    if (!id) {
      return jsonError("Report id is required.", 400);
    }

    const result = await duplicateSavedReport(id, access.user);

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error("Duplicate saved report error:", err);

    const message = err?.message || "Failed to duplicate report.";
    const status = message === "Report not found." ? 404 : 500;

    return jsonError(message, status);
  }
}