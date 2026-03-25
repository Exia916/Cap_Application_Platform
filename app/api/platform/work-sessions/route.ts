import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listWorkSessions,
  startWorkSession,
} from "@/lib/repositories/productionWorkSessionRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);
const CREATE_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

function isElevatedRole(role: string | null | undefined) {
  const v = String(role || "").trim().toUpperCase();
  return v === "ADMIN" || v === "MANAGER" || v === "SUPERVISOR";
}

type GetResp =
  | {
      rows: any[];
      totalCount: number;
    }
  | { error: string };

type PostResp =
  | {
      success: true;
      session: any;
    }
  | { error: string };

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<GetResp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, VIEW_ROLES)) {
      return NextResponse.json<GetResp>({ error: "Forbidden" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const employeeNumberRaw = sp.get("employeeNumber");
    const isOpenRaw = sp.get("isOpen");

    const elevated = isElevatedRole(auth.role);

    const authEmployeeNumber =
      auth.employeeNumber != null && Number.isFinite(Number(auth.employeeNumber))
        ? Number(auth.employeeNumber)
        : null;

    const requestedEmployeeNumber =
      employeeNumberRaw && Number.isFinite(Number(employeeNumberRaw))
        ? Number(employeeNumberRaw)
        : undefined;

    const effectiveEmployeeNumber = elevated
      ? requestedEmployeeNumber
      : authEmployeeNumber ?? undefined;

    if (!elevated && effectiveEmployeeNumber == null) {
      return NextResponse.json<GetResp>(
        { error: "Missing employee number in auth payload." },
        { status: 400 }
      );
    }

    const result = await listWorkSessions({
      moduleKey: sp.get("moduleKey")?.trim() || undefined,
      areaCode: sp.get("areaCode")?.trim() || undefined,
      employeeNumber: effectiveEmployeeNumber,
      userId: elevated ? sp.get("userId")?.trim() || undefined : undefined,
      isOpen:
        isOpenRaw === "true" ? true : isOpenRaw === "false" ? false : null,
      workDateFrom: sp.get("workDateFrom")?.trim() || undefined,
      workDateTo: sp.get("workDateTo")?.trim() || undefined,
      shiftDateFrom: sp.get("shiftDateFrom")?.trim() || undefined,
      shiftDateTo: sp.get("shiftDateTo")?.trim() || undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : 50,
      offset: sp.get("offset") ? Number(sp.get("offset")) : 0,
      sortBy: (sp.get("sortBy") as any) || "timeIn",
      sortDir: (sp.get("sortDir") as any) || "desc",
      includeVoided:
        roleOk(auth.role, new Set(["ADMIN", "MANAGER", "SUPERVISOR"])) &&
        sp.get("includeVoided") === "true",
      onlyVoided:
        roleOk(auth.role, new Set(["ADMIN"])) &&
        sp.get("onlyVoided") === "true",
    });

    return NextResponse.json<GetResp>(result, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "PLATFORM",
      eventType: "WORK_SESSIONS_LIST_FAILED",
      message: err?.message || "Failed to list work sessions",
      error: err,
    });

    return NextResponse.json<GetResp>(
      { error: "Failed to load work sessions." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<PostResp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, CREATE_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "PLATFORM",
        eventType: "WORK_SESSION_CREATE_FORBIDDEN",
        message: "User attempted to start work session without permission",
      });

      return NextResponse.json<PostResp>({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json<PostResp>({ error: "Invalid request body." }, { status: 400 });
    }

    const moduleKey = String(body.moduleKey ?? "").trim();
    const areaCode = String(body.areaCode ?? "").trim();
    const timeIn = new Date(String(body.timeIn ?? ""));
    const notes = String(body.notes ?? "").trim() || null;

    const employeeNumber =
      auth.employeeNumber != null && Number.isFinite(Number(auth.employeeNumber))
        ? Number(auth.employeeNumber)
        : null;

    const operatorName = String(
      auth.displayName ?? auth.name ?? auth.username ?? ""
    ).trim();

    if (!moduleKey) {
      return NextResponse.json<PostResp>({ error: "moduleKey is required." }, { status: 400 });
    }

    if (!areaCode) {
      return NextResponse.json<PostResp>({ error: "areaCode is required." }, { status: 400 });
    }

    if (Number.isNaN(timeIn.getTime())) {
      return NextResponse.json<PostResp>({ error: "A valid timeIn is required." }, { status: 400 });
    }

    if (!employeeNumber) {
      return NextResponse.json<PostResp>(
        { error: "Missing employee number in auth payload." },
        { status: 400 }
      );
    }

    if (!operatorName) {
      return NextResponse.json<PostResp>(
        { error: "Unable to resolve operator name from auth payload." },
        { status: 400 }
      );
    }

    const authName = operatorName;

    const session = await startWorkSession({
      moduleKey,
      areaCode,
      timeIn,
      userId: auth.userId != null ? String(auth.userId) : null,
      username: auth.username != null ? String(auth.username) : null,
      employeeNumber,
      operatorName,
      notes,
      createdBy: authName,
    });

    await logAuditEvent({
      req,
      auth,
      module: "PLATFORM",
      eventType: "WORK_SESSION_STARTED",
      message: "Production work session started",
      recordType: "production_work_sessions",
      recordId: session.id,
      details: {
        moduleKey: session.moduleKey,
        areaCode: session.areaCode,
        employeeNumber: session.employeeNumber,
        operatorName: session.operatorName,
        timeIn: session.timeIn,
      },
    });

    await createActivityHistory({
      entityType: "production_work_sessions",
      entityId: session.id,
      eventType: "CREATED",
      message: `Work session started for ${session.moduleKey} / ${session.areaCode}`,
      module: "PLATFORM",
      userId: auth.userId != null ? String(auth.userId) : null,
      userName: authName,
      employeeNumber,
    });

    return NextResponse.json<PostResp>({ success: true, session }, { status: 201 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "PLATFORM",
      eventType: "WORK_SESSION_CREATE_FAILED",
      message: err?.message || "Failed to start work session",
      error: err,
    });

    return NextResponse.json<PostResp>(
      { error: err?.message || "Failed to start work session." },
      { status: 500 }
    );
  }
}