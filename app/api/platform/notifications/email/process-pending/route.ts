import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { processPendingEmailNotifications } from "@/lib/services/notificationEmailProcessorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCronSecret() {
  return (
    String(process.env.CRON_SECRET ?? "").trim() ||
    String(process.env.CAP_CRON_SECRET ?? "").trim()
  );
}

function isCronAuthorized(req: NextRequest) {
  const secret = getCronSecret();
  if (!secret) return false;

  const authHeader = String(req.headers.get("authorization") ?? "").trim();
  if (authHeader === `Bearer ${secret}`) return true;

  const headerSecret = String(req.headers.get("x-cap-cron-secret") ?? "").trim();
  if (headerSecret && headerSecret === secret) return true;

  return false;
}

function isAdminAuthorized(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return false;

  return String(auth.role || "").toUpperCase() === "ADMIN";
}

function requireProcessAccess(req: NextRequest) {
  if (isCronAuthorized(req)) {
    return { ok: true as const, mode: "cron" as const };
  }

  if (isAdminAuthorized(req)) {
    return { ok: true as const, mode: "admin" as const };
  }

  return { ok: false as const, status: 401, error: "Unauthorized" };
}

function parseBool(value: string | null, fallback: boolean) {
  if (value == null || value === "") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;

  return fallback;
}

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;

  return Math.trunc(n);
}

export async function GET(req: NextRequest) {
  const access = requireProcessAccess(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const sp = req.nextUrl.searchParams;

    const result = await processPendingEmailNotifications({
      dryRun: parseBool(sp.get("dryRun"), false),
      limit: parseLimit(sp.get("limit")),
    });

    return NextResponse.json({
      ok: true,
      mode: access.mode,
      ...result,
    });
  } catch (err: any) {
    console.error("GET /api/platform/notifications/email/process-pending failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to process pending email notifications."
            : err?.message || "Failed to process pending email notifications.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const access = requireProcessAccess(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await req.json().catch(() => ({} as any));

    const result = await processPendingEmailNotifications({
      dryRun: body?.dryRun === true,
      limit:
        Number.isFinite(Number(body?.limit)) && Number(body?.limit) > 0
          ? Math.trunc(Number(body.limit))
          : undefined,
    });

    return NextResponse.json({
      ok: true,
      mode: access.mode,
      ...result,
    });
  } catch (err: any) {
    console.error("POST /api/platform/notifications/email/process-pending failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to process pending email notifications."
            : err?.message || "Failed to process pending email notifications.",
      },
      { status: 500 }
    );
  }
}