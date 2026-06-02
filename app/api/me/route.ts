import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

type FlatUser = {
  username: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
  department: string | null;
  userId: string | null;

  email: string | null;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  managerUserId: string | null;
};

type MeResponse = FlatUser & {
  user: FlatUser | null;
  error?: string;
};

function emptyResponse(error = "Not authenticated"): MeResponse {
  return {
    error,
    username: null,
    displayName: null,
    employeeNumber: null,
    role: null,
    department: null,
    userId: null,
    email: null,
    emailNotificationsEnabled: true,
    inAppNotificationsEnabled: true,
    managerUserId: null,
    user: null,
  };
}

function authUserId(auth: any): string | null {
  const value = auth?.id ?? auth?.userId ?? auth?.sub ?? null;
  return value == null ? null : String(value);
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json(emptyResponse(), { status: 401 });
  }

  const userId = authUserId(auth);

  const basePayload: FlatUser = {
    username: (auth as any).username ?? null,
    displayName:
      (auth as any).displayName ??
      (auth as any).name ??
      (auth as any).username ??
      null,
    employeeNumber:
      (auth as any).employeeNumber != null
        ? Number((auth as any).employeeNumber)
        : (auth as any).userId != null
          ? Number((auth as any).userId)
          : null,
    role: (auth as any).role ?? null,
    department: (auth as any).department ?? null,
    userId,

    email: null,
    emailNotificationsEnabled: true,
    inAppNotificationsEnabled: true,
    managerUserId: null,
  };

  if (!userId) {
    return NextResponse.json<MeResponse>(
      {
        ...basePayload,
        user: basePayload,
      },
      { status: 200 }
    );
  }

  try {
    const { rows } = await db.query<{
      username: string | null;
      displayName: string | null;
      employeeNumber: number | null;
      role: string | null;
      department: string | null;
      email: string | null;
      emailNotificationsEnabled: boolean;
      inAppNotificationsEnabled: boolean;
      managerUserId: string | null;
    }>(
      `
      SELECT
        username,
        display_name AS "displayName",
        employee_number AS "employeeNumber",
        role,
        department,
        email,
        COALESCE(email_notifications_enabled, true) AS "emailNotificationsEnabled",
        COALESCE(in_app_notifications_enabled, true) AS "inAppNotificationsEnabled",
        manager_user_id AS "managerUserId"
      FROM public.users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const dbUser = rows[0];

    const payload: FlatUser = {
      ...basePayload,
      username: dbUser?.username ?? basePayload.username,
      displayName: dbUser?.displayName ?? basePayload.displayName,
      employeeNumber: dbUser?.employeeNumber ?? basePayload.employeeNumber,
      role: dbUser?.role ?? basePayload.role,
      department: dbUser?.department ?? basePayload.department,
      email: dbUser?.email ?? null,
      emailNotificationsEnabled: dbUser?.emailNotificationsEnabled ?? true,
      inAppNotificationsEnabled: dbUser?.inAppNotificationsEnabled ?? true,
      managerUserId: dbUser?.managerUserId ?? null,
    };

    return NextResponse.json<MeResponse>(
      {
        ...payload,
        user: payload,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/me failed:", err);

    return NextResponse.json<MeResponse>(
      {
        ...basePayload,
        user: basePayload,
      },
      { status: 200 }
    );
  }
}
