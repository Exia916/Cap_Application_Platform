import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  closeWorkSession,
  getWorkSessionById,
  validateSessionBelongsToUser,
} from "@/lib/repositories/productionWorkSessionRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

const CLOSE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);
const POWER_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

type Resp =
  | { success: true; session: any }
  | { error: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, CLOSE_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "PLATFORM",
        eventType: "WORK_SESSION_CLOSE_FORBIDDEN",
        message: "User attempted to close work session without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const current = await getWorkSessionById(id, { includeVoided: true });

    if (!current) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    const role = String(auth.role ?? "").trim().toUpperCase();
    const isPower = POWER_ROLES.has(role);

    if (!isPower) {
      const employeeNumber =
        auth.employeeNumber != null ? Number(auth.employeeNumber) : null;

      if (!employeeNumber || !Number.isFinite(employeeNumber)) {
        return NextResponse.json<Resp>(
          { error: "Missing employee number in auth payload." },
          { status: 400 }
        );
      }

      const session = await validateSessionBelongsToUser({
        sessionId: id,
        moduleKey: current.moduleKey,
        employeeNumber,
        requireOpen: true,
      });

      if (!session) {
        return NextResponse.json<Resp>(
          { error: "You can only close your own open work session." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    const timeOut = new Date(String(body?.timeOut ?? new Date().toISOString()));

    if (Number.isNaN(timeOut.getTime())) {
      return NextResponse.json<Resp>({ error: "A valid timeOut is required." }, { status: 400 });
    }

    const authName = String(
      auth.displayName ?? auth.name ?? auth.username ?? "Unknown"
    ).trim();

    const session = await closeWorkSession({
      sessionId: id,
      timeOut,
      updatedBy: authName,
    });

    await logAuditEvent({
      req,
      auth,
      module: "PLATFORM",
      eventType: "WORK_SESSION_CLOSED",
      message: "Production work session closed",
      recordType: "production_work_sessions",
      recordId: session.id,
      details: {
        moduleKey: session.moduleKey,
        areaCode: session.areaCode,
        employeeNumber: session.employeeNumber,
        timeIn: session.timeIn,
        timeOut: session.timeOut,
      },
    });

    await createActivityHistory({
      entityType: "production_work_sessions",
      entityId: session.id,
      eventType: "STATUS_CHANGED",
      message: `Work session closed for ${session.moduleKey} / ${session.areaCode}`,
      module: "PLATFORM",
      userId: auth.userId != null ? String(auth.userId) : null,
      userName: authName,
      employeeNumber:
        auth.employeeNumber != null ? Number(auth.employeeNumber) : null,
    });

    return NextResponse.json<Resp>({ success: true, session }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "PLATFORM",
      eventType: "WORK_SESSION_CLOSE_FAILED",
      message: err?.message || "Failed to close work session",
      error: err,
    });

    return NextResponse.json<Resp>(
      { error: err?.message || "Failed to close work session." },
      { status: 500 }
    );
  }
}