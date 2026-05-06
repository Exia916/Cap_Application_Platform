import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getQCSubmissionWithLines,
  voidQCSubmission,
} from "@/lib/repositories/qcRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

export const runtime = "nodejs";

type Resp = { ok: true } | { error: string };

const VOID_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined) {
  return VOID_ROLES.has(String(role || "").trim().toUpperCase());
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
  try {
    const auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    const authAny = auth as any;

    if (!roleOk(authAny.role)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const params = await ctx.params;
    const id = String(params?.id ?? "").trim();

    if (!id) {
      return NextResponse.json<Resp>({ error: "Invalid id" }, { status: 400 });
    }

    const { submission } = await getQCSubmissionWithLines(id, {
      includeVoided: true,
    });

    if (!submission) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    if (submission.isVoided) {
      return NextResponse.json<Resp>(
        { error: "Submission is already voided." },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = String((body as any)?.reason ?? "").trim() || null;

    const authName = String(
      authAny.displayName ?? authAny.name ?? authAny.username ?? "Unknown"
    ).trim();

    const ok = await voidQCSubmission({
      id,
      voidedBy: authName,
      reason,
    });

    if (!ok) {
      return NextResponse.json<Resp>(
        { error: "Unable to void submission." },
        { status: 409 }
      );
    }

    await createActivityHistory({
      entityType: "qc_daily_submissions",
      entityId: id,
      eventType: "VOIDED",
      message: reason
        ? `QC submission voided: ${reason}`
        : "QC submission voided",
      module: "QC",
      userId: authAny.userId != null ? String(authAny.userId) : null,
      userName: authName,
      employeeNumber:
        authAny.employeeNumber != null ? Number(authAny.employeeNumber) : null,
      salesOrder: parseSalesOrderNumber(
        submission.salesOrderDisplay ?? submission.salesOrderBase ?? null
      ),
      newValue: {
        isVoided: true,
        reason,
      },
    });

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("qc-daily-production-submission void POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}