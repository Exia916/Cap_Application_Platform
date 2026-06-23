import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAuthUserId,
  getExternalPartnerContextForUserId,
  type ExternalModuleAccess,
} from "@/lib/repositories/externalPartnerRepo";

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

  isExternal: boolean;
  externalPartnerUserId: string | null;
  externalPartnerId: string | null;
  externalPartnerCode: string | null;
  externalPartnerName: string | null;
  externalPartnerType: string | null;
  externalRole: string | null;
  externalModules: ExternalModuleAccess[];
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

    isExternal: false,
    externalPartnerUserId: null,
    externalPartnerId: null,
    externalPartnerCode: null,
    externalPartnerName: null,
    externalPartnerType: null,
    externalRole: null,
    externalModules: [],

    user: null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json(emptyResponse(), { status: 401 });
  }

  const userId = getAuthUserId(auth);

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
        : null,
    role: (auth as any).role ?? null,
    department: (auth as any).department ?? null,
    userId,

    email: null,
    emailNotificationsEnabled: true,
    inAppNotificationsEnabled: true,
    managerUserId: null,

    isExternal: false,
    externalPartnerUserId: null,
    externalPartnerId: null,
    externalPartnerCode: null,
    externalPartnerName: null,
    externalPartnerType: null,
    externalRole: null,
    externalModules: [],
  };

  if (!userId) {
    return NextResponse.json<MeResponse>(
      {
        ...basePayload,
        user: basePayload,
      },
      { status: 200 },
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
        manager_user_id::text AS "managerUserId"
      FROM public.users
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [userId],
    );

    const dbUser = rows[0];
    const external = await getExternalPartnerContextForUserId(userId);

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

      isExternal: !!external,
      externalPartnerUserId: external?.externalPartnerUserId ?? null,
      externalPartnerId: external?.externalPartnerId ?? null,
      externalPartnerCode: external?.externalPartnerCode ?? null,
      externalPartnerName: external?.externalPartnerName ?? null,
      externalPartnerType: external?.externalPartnerType ?? null,
      externalRole: external?.externalRole ?? null,
      externalModules: external?.externalModules ?? [],
    };

    return NextResponse.json<MeResponse>(
      {
        ...payload,
        user: payload,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/me failed:", err);

    return NextResponse.json<MeResponse>(
      {
        ...basePayload,
        user: basePayload,
      },
      { status: 200 },
    );
  }
}