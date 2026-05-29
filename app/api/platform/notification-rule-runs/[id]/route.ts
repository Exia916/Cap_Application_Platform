import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getPlatformNotificationRuleRunById } from "@/lib/repositories/platformNotificationRuleRunsRepo";

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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const access = requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    const row = await getPlatformNotificationRuleRunById(id);

    if (!row) {
      return NextResponse.json({ error: "Rule run not found." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    console.error(`GET /api/platform/notification-rule-runs/${id} failed:`, err);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to load notification rule run."
            : err?.message || "Failed to load notification rule run.",
      },
      { status: 500 }
    );
  }
}