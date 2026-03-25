import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getWorkSessionById,
  listAvailableWorkAreas,
  listRelatedKnitSubmissionsForSession,
  updateWorkSession,
} from "@/lib/repositories/productionWorkSessionRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError } from "@/lib/logging/logger";

export const runtime = "nodejs";

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);
const EDIT_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

function isElevatedRole(role: string | null | undefined) {
  const v = String(role || "").trim().toUpperCase();
  return v === "ADMIN" || v === "MANAGER" || v === "SUPERVISOR";
}

type GetResp =
  | {
      session: any;
      areas: any[];
      knitSubmissions: any[];
      canManage: boolean;
    }
  | { error: string };

type PatchResp =
  | {
      success: true;
      session: any;
    }
  | { error: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json<GetResp>({ error: "Unauthorized" }, { status: 401 });
  }

  if (!roleOk(auth.role, VIEW_ROLES)) {
    return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const session = await getWorkSessionById(id, {
    includeVoided:
      isElevatedRole(auth.role) &&
      req.nextUrl.searchParams.get("includeVoided") === "true",
  });

  if (!session) {
    return NextResponse.json<GetResp>({ error: "Not found" }, { status: 404 });
  }

  const elevated = isElevatedRole(auth.role);

  const ownsByUserId =
    auth.userId != null &&
    session.userId != null &&
    String(auth.userId) === String(session.userId);

  const ownsByEmployee =
    auth.employeeNumber != null &&
    session.employeeNumber != null &&
    Number(auth.employeeNumber) === Number(session.employeeNumber);

  if (!elevated && !ownsByUserId && !ownsByEmployee) {
    return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
  }

  const areas = await listAvailableWorkAreas(session.moduleKey);
  const knitSubmissions =
    session.moduleKey === "knit_production"
      ? await listRelatedKnitSubmissionsForSession(session.id)
      : [];

  const canManage = elevated || ownsByUserId || ownsByEmployee;

  return NextResponse.json<GetResp>(
    {
      session,
      areas,
      knitSubmissions,
      canManage,
    },
    { status: 200 }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<PatchResp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, EDIT_ROLES)) {
      return NextResponse.json<PatchResp>({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const current = await getWorkSessionById(id, { includeVoided: true });

    if (!current) {
      return NextResponse.json<PatchResp>({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json<PatchResp>({ error: "Invalid request body." }, { status: 400 });
    }

    const parsedTimeIn =
      body.timeIn == null || body.timeIn === ""
        ? undefined
        : new Date(String(body.timeIn));

    const parsedTimeOut =
      body.timeOut === undefined
        ? undefined
        : body.timeOut === null || body.timeOut === ""
          ? null
          : new Date(String(body.timeOut));

    if (parsedTimeIn instanceof Date && Number.isNaN(parsedTimeIn.getTime())) {
      return NextResponse.json<PatchResp>({ error: "Invalid timeIn." }, { status: 400 });
    }

    if (parsedTimeOut instanceof Date && Number.isNaN(parsedTimeOut.getTime())) {
      return NextResponse.json<PatchResp>({ error: "Invalid timeOut." }, { status: 400 });
    }

    const authName = String(
      auth.displayName ?? auth.name ?? auth.username ?? "Unknown"
    ).trim();

    const updated = await updateWorkSession({
      id,
      areaCode:
        typeof body.areaCode === "string" ? String(body.areaCode).trim() || null : undefined,
      timeIn: parsedTimeIn,
      timeOut: parsedTimeOut,
      notes:
        body.notes === undefined
          ? undefined
          : body.notes == null
            ? null
            : String(body.notes),
      userId: auth.userId != null ? String(auth.userId) : null,
      employeeNumber:
        auth.employeeNumber != null && Number.isFinite(Number(auth.employeeNumber))
          ? Number(auth.employeeNumber)
          : null,
      role: auth.role != null ? String(auth.role) : null,
      updatedBy: authName,
    });

    await logAuditEvent({
      req,
      auth,
      module: "PLATFORM",
      eventType: "WORK_SESSION_UPDATED",
      message: "Production work session updated",
      recordType: "production_work_sessions",
      recordId: updated.id,
      details: {
        moduleKey: updated.moduleKey,
        areaCode: updated.areaCode,
        employeeNumber: updated.employeeNumber,
        timeIn: updated.timeIn,
        timeOut: updated.timeOut,
        isOpen: updated.isOpen,
      },
    });

    await createActivityHistory({
      entityType: "production_work_sessions",
      entityId: updated.id,
      eventType: "UPDATED",
      message: "Work session updated",
      module: "PLATFORM",
      userId: auth.userId != null ? String(auth.userId) : null,
      userName: authName,
      employeeNumber:
        auth.employeeNumber != null ? Number(auth.employeeNumber) : null,
    });

    return NextResponse.json<PatchResp>(
      { success: true, session: updated },
      { status: 200 }
    );
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "PLATFORM",
      eventType: "WORK_SESSION_UPDATE_FAILED",
      message: err?.message || "Failed to update work session",
      error: err,
    });

    return NextResponse.json<PatchResp>(
      { error: err?.message || "Failed to update work session." },
      { status: 500 }
    );
  }
}