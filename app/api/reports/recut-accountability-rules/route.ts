// app/api/reports/recut-accountability-rules/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, type AuthUserWithLegacy } from "@/lib/auth";
import { requireReportAccess } from "@/lib/reports/reportPermissions";
import {
  createRecutAccountabilityRule,
  listRecutAccountabilityRules,
  listUnclassifiedRecutReasons,
} from "@/lib/repositories/recutAccountabilityRulesRepo";

export const runtime = "nodejs";

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

export async function GET(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  try {
    const [rules, unclassifiedReasons] = await Promise.all([
      listRecutAccountabilityRules(),
      listUnclassifiedRecutReasons(),
    ]);

    return NextResponse.json({ rules, unclassifiedReasons });
  } catch (err: any) {
    console.error("Recut accountability rules load error:", err);

    return jsonError(
      err?.message || "Failed to load recut accountability rules.",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  const access = requireReportAccess(getAuthFromRequest(req));

  if (!access.ok) {
    return jsonError(access.error, access.status);
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid recut accountability rule request.", 400);
    }

    const reasonLabel = String((body as any).reasonLabel ?? "").trim();
    if (!reasonLabel) {
      return jsonError("Reason label is required.", 400);
    }

    const rule = await createRecutAccountabilityRule({
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

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err: any) {
    console.error("Recut accountability rule create error:", err);

    return jsonError(
      err?.message || "Failed to create recut accountability rule.",
      500
    );
  }
}