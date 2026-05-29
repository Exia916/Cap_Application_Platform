import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getPlatformNotificationRuleById,
  setPlatformNotificationRuleActive,
  updatePlatformNotificationRule,
} from "@/lib/repositories/platformNotificationRulesRepo";

export const runtime = "nodejs";

function requirePlatformAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const role = String(auth.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, auth };
}

function currentUserId(auth: any): string | null {
  return auth?.id ? String(auth.id) : null;
}

function errorMessage(err: any, fallback: string) {
  const raw = String(err?.message || "");

  if (
    raw.toLowerCase().includes("foreign key") ||
    raw.toLowerCase().includes("violates foreign key")
  ) {
    return "Selected event type, Workflow status, or user is invalid.";
  }

  if (
    raw.toLowerCase().includes("check constraint") ||
    raw.toLowerCase().includes("violates check")
  ) {
    return "Rule settings failed validation.";
  }

  return process.env.NODE_ENV === "production" ? fallback : raw || fallback;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    const row = await getPlatformNotificationRuleById(id);
    if (!row) {
      return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error(`GET /api/platform/notification-rules/${id} failed:`, err);
    return NextResponse.json(
      { error: errorMessage(err, "Failed to load notification rule.") },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const row = await updatePlatformNotificationRule({
      ...body,
      id,
      updatedBy: currentUserId(access.auth),
    });

    if (!row) {
      return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error(`PUT /api/platform/notification-rules/${id} failed:`, err);

    const msg = errorMessage(err, "Failed to update notification rule.");
    const status =
      msg.includes("required") ||
      msg.includes("invalid") ||
      msg.includes("Invalid") ||
      msg.includes("Only ") ||
      msg.includes("greater than") ||
      msg.includes("email")
        ? 400
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    const row = await setPlatformNotificationRuleActive({
      id,
      isActive: false,
      updatedBy: currentUserId(access.auth),
    });

    if (!row) {
      return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error(`DELETE /api/platform/notification-rules/${id} failed:`, err);
    return NextResponse.json(
      { error: errorMessage(err, "Failed to deactivate notification rule.") },
      { status: 500 }
    );
  }
}