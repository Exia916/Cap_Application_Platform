import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listPlatformNotificationRuleRuns } from "@/lib/repositories/platformNotificationRuleRunsRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  if (String(auth.role || "").toUpperCase() !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, auth };
}

function parseIntParam(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.trunc(n);
}

export async function GET(req: NextRequest) {
  const access = requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const sp = req.nextUrl.searchParams;

  try {
    const result = await listPlatformNotificationRuleRuns({
      q: sp.get("q"),
      ruleId: sp.get("ruleId"),
      eventType: sp.get("eventType"),
      triggerType: sp.get("triggerType"),
      deliveryStatus: sp.get("deliveryStatus"),
      entityType: sp.get("entityType"),
      recipient: sp.get("recipient"),
      dateFrom: sp.get("dateFrom"),
      dateTo: sp.get("dateTo"),
      limit: parseIntParam(sp.get("limit"), 100),
      offset: parseIntParam(sp.get("offset"), 0),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GET /api/platform/notification-rule-runs failed:", err);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to load notification rule runs."
            : err?.message || "Failed to load notification rule runs.",
      },
      { status: 500 }
    );
  }
}