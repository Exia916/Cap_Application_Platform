import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getNotificationSystemStatus } from "@/lib/repositories/platformJobRunsRepo";

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

export async function GET(req: NextRequest) {
  const access = requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const status = await getNotificationSystemStatus();
    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    console.error("GET /api/platform/notifications/status failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to load notification system status."
            : err?.message || "Failed to load notification system status.",
      },
      { status: 500 }
    );
  }
}