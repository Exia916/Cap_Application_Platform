import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getKnitProductionSubmissionById,
  voidKnitProductionSubmission,
} from "@/lib/repositories/knitProductionRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type Resp = { ok: true } | { error: string };

const VOID_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
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
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;
  let id = "";

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, VOID_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_PRODUCTION",
        eventType: "KNIT_PRODUCTION_VOID_FORBIDDEN",
        message: "User attempted to void knit production submission without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    id = String(params?.id ?? "").trim();

    if (!id) {
      return NextResponse.json<Resp>({ error: "Invalid id" }, { status: 400 });
    }

    const current = await getKnitProductionSubmissionById(id, { includeVoided: true });

    if (!current) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    if (current.isVoided) {
      return NextResponse.json<Resp>({ error: "Submission is already voided." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = String((body as any)?.reason ?? "").trim() || null;

    const authName = String(
      auth.displayName ?? auth.name ?? auth.username ?? "Unknown"
    ).trim();

    const ok = await voidKnitProductionSubmission({
      id,
      voidedBy: authName,
      reason,
    });

    if (!ok) {
      return NextResponse.json<Resp>({ error: "Unable to void submission." }, { status: 409 });
    }

    const userId = auth.userId != null ? String(auth.userId) : null;
    const employeeNumber =
      auth.employeeNumber != null ? Number(auth.employeeNumber) : null;
    const salesOrderNum = parseSalesOrderNumber(
      current.salesOrderDisplay ?? current.salesOrderBase ?? null
    );

    await logAuditEvent({
      req,
      auth,
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_PRODUCTION_VOIDED",
      message: "Knit production submission voided",
      recordType: "knit_production_submissions",
      recordId: id,
      details: {
        salesOrder: current.salesOrderDisplay ?? current.salesOrderBase ?? null,
        reason,
      },
    });

    await createActivityHistory({
      entityType: "knit_production_submissions",
      entityId: id,
      eventType: "VOIDED",
      message: reason
        ? `Knit production submission voided: ${reason}`
        : "Knit production submission voided",
      module: "KNIT_PRODUCTION",
      userId,
      userName: authName,
      employeeNumber,
      salesOrder: salesOrderNum,
      newValue: {
        isVoided: true,
        reason,
      },
    });

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_PRODUCTION_VOID_ERROR",
      message: "Failed to void knit production submission",
      recordType: "knit_production_submissions",
      recordId: id || null,
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("knit-production-submission void POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}