import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  evaluateNotificationRules,
  type EvaluateNotificationRulesInput,
} from "@/lib/services/notificationRuleEvaluatorService";

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

function requireEvaluateAccess(req: NextRequest) {
  if (isCronAuthorized(req)) {
    return { ok: true as const, mode: "cron" as const };
  }

  if (isAdminAuthorized(req)) {
    return { ok: true as const, mode: "admin" as const };
  }

  return { ok: false as const, status: 401, error: "Unauthorized" };
}

function parseBool(value: string | null | undefined, fallback: boolean) {
  if (value == null || value === "") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;

  return fallback;
}

function parseLimit(value: string | null | undefined): number | undefined {
  if (!value) return undefined;

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;

  return Math.trunc(n);
}

function defaultLimitPerRule() {
  return parseLimit(process.env.CAP_NOTIFICATION_RULE_EVALUATOR_LIMIT_PER_RULE) ?? 100;
}

function cronShouldExecute() {
  return parseBool(process.env.CAP_NOTIFICATION_RULE_EVALUATOR_CRON_EXECUTE, false);
}

function buildInputFromSearchParams(
  req: NextRequest,
  mode: "cron" | "admin"
): EvaluateNotificationRulesInput {
  const sp = req.nextUrl.searchParams;

  const queryHasExecute = sp.has("execute");
  const queryHasDryRun = sp.has("dryRun");

  let dryRun = true;

  if (mode === "cron") {
    dryRun = !cronShouldExecute();
  }

  if (queryHasExecute) {
    dryRun = !parseBool(sp.get("execute"), false);
  } else if (queryHasDryRun) {
    dryRun = parseBool(sp.get("dryRun"), true);
  }

  return {
    dryRun,
    limitPerRule: parseLimit(sp.get("limitPerRule")) ?? defaultLimitPerRule(),
    ruleId: sp.get("ruleId") || null,
  };
}

async function buildInputFromBody(req: NextRequest): Promise<EvaluateNotificationRulesInput> {
  const body = await req.json().catch(() => ({} as any));

  const execute = body?.execute === true;
  const dryRun =
    execute ? false : typeof body?.dryRun === "boolean" ? body.dryRun : true;

  return {
    dryRun,
    limitPerRule:
      Number.isFinite(Number(body?.limitPerRule)) && Number(body?.limitPerRule) > 0
        ? Math.trunc(Number(body.limitPerRule))
        : defaultLimitPerRule(),
    ruleId: body?.ruleId ? String(body.ruleId) : null,
  };
}

/**
 * GET is used by Vercel Cron and can also be opened by Admins.
 *
 * Safe default:
 * - Admin GET defaults to dryRun=true.
 * - Cron GET defaults to dryRun=true unless:
 *   CAP_NOTIFICATION_RULE_EVALUATOR_CRON_EXECUTE=true
 *
 * Examples:
 * - /api/platform/notification-rules/evaluate
 * - /api/platform/notification-rules/evaluate?dryRun=true
 * - /api/platform/notification-rules/evaluate?execute=true
 */
export async function GET(req: NextRequest) {
  const access = requireEvaluateAccess(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const input = buildInputFromSearchParams(req, access.mode);
    const result = await evaluateNotificationRules(input);

    return NextResponse.json({
      ok: true,
      mode: access.mode,
      cronExecuteEnabled: cronShouldExecute(),
      ...result,
    });
  } catch (err: any) {
    console.error("GET /api/platform/notification-rules/evaluate failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to evaluate notification rules."
            : err?.message || "Failed to evaluate notification rules.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST is useful for admin/manual testing.
 *
 * Body examples:
 * { "dryRun": true }
 * { "execute": true }
 * { "dryRun": true, "ruleId": "...", "limitPerRule": 10 }
 */
export async function POST(req: NextRequest) {
  const access = requireEvaluateAccess(req);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const input = await buildInputFromBody(req);
    const result = await evaluateNotificationRules(input);

    return NextResponse.json({
      ok: true,
      mode: access.mode,
      cronExecuteEnabled: cronShouldExecute(),
      ...result,
    });
  } catch (err: any) {
    console.error("POST /api/platform/notification-rules/evaluate failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to evaluate notification rules."
            : err?.message || "Failed to evaluate notification rules.",
      },
      { status: 500 }
    );
  }
}