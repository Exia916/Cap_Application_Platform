import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/repositories/userNotificationPreferencesRepo";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

export const runtime = "nodejs";

type NotificationPreferencesBody = {
  emailNotificationsEnabled?: boolean;
  inAppNotificationsEnabled?: boolean;
};

function getAuthUserId(auth: any): string | null {
  const id = auth?.id;
  return id != null && String(id).trim() ? String(id).trim() : null;
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = getAuthUserId(auth);

  if (!userId) {
    return NextResponse.json(
      { error: "Unable to identify authenticated user." },
      { status: 400 }
    );
  }

  try {
    const preferences = await getUserNotificationPreferences(userId);

    if (!preferences) {
      return NextResponse.json(
        { error: "User notification preferences were not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ preferences }, { status: 200 });
  } catch (error) {
    await logError({
      req,
      category: "API",
      module: "ACCOUNT",
      eventType: "ACCOUNT_NOTIFICATION_PREFERENCES_LOAD_ERROR",
      message: "Failed to load account notification preferences",
      auth,
      error,
    });

    return NextResponse.json(
      { error: "Failed to load notification preferences." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = getAuthUserId(auth);

  if (!userId) {
    return NextResponse.json(
      { error: "Unable to identify authenticated user." },
      { status: 400 }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as NotificationPreferencesBody | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const current = await getUserNotificationPreferences(userId);

    if (!current) {
      return NextResponse.json(
        { error: "User notification preferences were not found." },
        { status: 404 }
      );
    }

    const preferences = await updateUserNotificationPreferences({
      userId,
      emailNotificationsEnabled: normalizeBool(
        body.emailNotificationsEnabled,
        current.emailNotificationsEnabled
      ),
      inAppNotificationsEnabled: normalizeBool(
        body.inAppNotificationsEnabled,
        current.inAppNotificationsEnabled
      ),
    });

    await logSecurityEvent({
      req,
      category: "SECURITY",
      module: "ACCOUNT",
      eventType: "NOTIFICATION_PREFERENCES_UPDATED",
      message: "User updated notification preferences",
      auth,
      username: auth.username,
      employeeNumber: auth.employeeNumber,
      role: auth.role,
      details: {
        userId,
        emailNotificationsEnabled: preferences?.emailNotificationsEnabled ?? null,
        inAppNotificationsEnabled: preferences?.inAppNotificationsEnabled ?? null,
      },
    });

    return NextResponse.json({ preferences }, { status: 200 });
  } catch (error: any) {
    await logError({
      req,
      category: "API",
      module: "ACCOUNT",
      eventType: "ACCOUNT_NOTIFICATION_PREFERENCES_SAVE_ERROR",
      message: "Failed to save account notification preferences",
      auth,
      error,
    });

    return NextResponse.json(
      { error: error?.message || "Failed to save notification preferences." },
      { status: 500 }
    );
  }
}