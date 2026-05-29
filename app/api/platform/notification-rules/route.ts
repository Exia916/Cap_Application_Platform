import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createPlatformNotificationRule,
  listPlatformNotificationRules,
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

export async function GET(req: NextRequest) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const sp = req.nextUrl.searchParams;

  try {
    const rows = await listPlatformNotificationRules({
      q: sp.get("q"),
      module: sp.get("module"),
      eventType: sp.get("eventType"),
      triggerType: sp.get("triggerType"),
      recipientMode: sp.get("recipientMode"),
      activeOnly: sp.get("activeOnly") === "true",
    });

    return NextResponse.json({ rows });
  } catch (err: any) {
    console.error("GET /api/platform/notification-rules failed:", err);
    return NextResponse.json(
      { error: errorMessage(err, "Failed to load notification rules.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const access = requirePlatformAdmin(req);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const row = await createPlatformNotificationRule({
      ...body,
      createdBy: currentUserId(access.auth),
      updatedBy: currentUserId(access.auth),
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/platform/notification-rules failed:", err);

    const msg = errorMessage(err, "Failed to create notification rule.");
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