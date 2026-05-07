import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getEmbroiderySubmissionWithLines,
  voidEmbroiderySubmission,
} from "@/lib/repositories/embroideryRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";

const VOID_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOf(auth: any): string {
  return String(auth?.role ?? "").trim().toUpperCase();
}

function canVoid(auth: any): boolean {
  return VOID_ROLES.has(roleOf(auth));
}

function authDisplayName(auth: any): string {
  return String(
    auth?.displayName ?? auth?.name ?? auth?.username ?? "Unknown"
  ).trim();
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
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canVoid(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const submissionId = String(id ?? "").trim();

  if (!submissionId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await getEmbroiderySubmissionWithLines(submissionId, {
    includeVoided: true,
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.submission.isVoided) {
    return NextResponse.json(
      { error: "This submission is already voided." },
      { status: 409 }
    );
  }

  let reason: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    reason = String(body?.reason ?? "").trim() || null;
  } catch {
    reason = null;
  }

  const voidedBy = authDisplayName(auth);

  const voided = await voidEmbroiderySubmission({
    submissionId,
    voidedBy,
    voidReason: reason,
  });

  if (!voided) {
    return NextResponse.json(
      { error: "Unable to void submission." },
      { status: 409 }
    );
  }

  const salesOrderNumber = parseSalesOrderNumber(
    existing.submission.salesOrderDisplay ??
      existing.submission.salesOrderBase ??
      existing.submission.salesOrder
  );

  await createActivityHistory({
    entityType: "embroidery_daily_submissions",
    entityId: submissionId,
    eventType: "VOIDED",
    message: reason
      ? `Embroidery submission voided. Reason: ${reason}`
      : "Embroidery submission voided.",
    module: "Embroidery",
    userId: auth.userId != null ? String(auth.userId) : null,
    userName: voidedBy,
    employeeNumber:
      auth.employeeNumber != null ? Number(auth.employeeNumber) : null,
    salesOrder: salesOrderNumber,
    previousValue: {
      isVoided: false,
    },
    newValue: {
      isVoided: true,
      voidedBy,
      reason,
    },
  });

  return NextResponse.json(
    {
      success: true,
      submission: voided,
    },
    { status: 200 }
  );
}