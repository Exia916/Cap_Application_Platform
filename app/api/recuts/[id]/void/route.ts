import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { getRecutRequestById, voidRecutRequest } from "@/lib/repositories/recutRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type Resp = { ok: true } | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_VOID_FORBIDDEN",
        message: "User attempted to void recut request without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    id = String(params?.id || "").trim();

    if (!id) {
      return NextResponse.json<Resp>({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason =
      typeof (body as any)?.reason === "string" && (body as any).reason.trim()
        ? String((body as any).reason).trim()
        : null;

    const current = await getRecutRequestById(id, { includeVoided: true });

    if (!current) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    if (current.isVoided) {
      return NextResponse.json<Resp>({ error: "Recut request already voided" }, { status: 409 });
    }

    const userName = String(
      (auth as any).displayName ??
      (auth as any).username ??
      (auth as any).email ??
      "Unknown"
    ).trim();

    const ok = await voidRecutRequest({
      id,
      voidedBy: userName,
      reason,
    });

    if (!ok) {
      return NextResponse.json<Resp>({ error: "Unable to void recut request" }, { status: 400 });
    }

    await logAuditEvent({
      req,
      auth,
      module: "RECUT",
      eventType: "RECUT_VOIDED",
      message: "Recut request voided",
      recordType: "recut_requests",
      recordId: id,
      details: {
        recutId: current.recutId,
        reason,
        salesOrder: current.salesOrder,
        detailNumber: current.detailNumber,
      },
    });

    await createActivityHistory({
      entityType: "recut_requests",
      entityId: id,
      eventType: "VOIDED",
      fieldName: "isVoided",
      previousValue: false,
      newValue: true,
      message: reason ? `Recut request voided: ${reason}` : "Recut request voided",
      module: "RECUT",
      userId: (auth as any).userId != null ? String((auth as any).userId) : null,
      userName,
      employeeNumber:
        (auth as any).employeeNumber != null ? Number((auth as any).employeeNumber) : null,
      salesOrder: parseSalesOrderNumber(current.salesOrder),
      detailNumber: current.detailNumber ?? null,
    });

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_VOID_ERROR",
      message: "Failed to void recut request",
      recordType: "recut_requests",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recut void POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}