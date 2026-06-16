// app/api/reports/recut-accountability-rules/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, type AuthUserWithLegacy } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import { updateRecutAccountabilityRule } from "@/lib/repositories/recutAccountabilityRulesRepo";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function actorName(user: AuthUserWithLegacy) {
  return (
    user.displayName?.trim() ||
    user.name?.trim() ||
    user.username?.trim() ||
    String(user.employeeNumber || "").trim() ||
    null
  );
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid recut accountability rule request.", 400);
    }

    const reasonLabel = String((body as any).reasonLabel ?? "").trim();
    if (!reasonLabel) {
      return jsonError("Reason label is required.", 400);
    }

    const rule = await updateRecutAccountabilityRule(id, {
      reasonLabel,
      isAccountable:
        typeof (body as any).isAccountable === "boolean"
          ? (body as any).isAccountable
          : true,
      isActive:
        typeof (body as any).isActive === "boolean"
          ? (body as any).isActive
          : true,
      notes: (body as any).notes ?? null,
      sortOrder: (body as any).sortOrder ?? 0,
      actor: actorName(access.user),
    });

    if (!rule) {
      return jsonError("Recut accountability rule not found.", 404);
    }

    return NextResponse.json({ rule });
  } catch (err: any) {
    console.error("Recut accountability rule update error:", err);

    return jsonError(
      err?.message || "Failed to update recut accountability rule.",
      500
    );
  }
}