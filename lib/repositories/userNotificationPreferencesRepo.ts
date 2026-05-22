import { db } from "@/lib/db";

export type UserNotificationPreferences = {
  userId: string;
  email: string | null;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  updatedAt: string | null;
};

export type UpdateUserNotificationPreferencesInput = {
  userId: string;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
};

export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences | null> {
  const { rows } = await db.query<UserNotificationPreferences>(
    `
    SELECT
      id::text AS "userId",
      email,
      COALESCE(email_notifications_enabled, true) AS "emailNotificationsEnabled",
      COALESCE(in_app_notifications_enabled, true) AS "inAppNotificationsEnabled",
      updated_at AS "updatedAt"
    FROM public.users
    WHERE id = $1
      AND is_active = true
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

export async function updateUserNotificationPreferences(
  input: UpdateUserNotificationPreferencesInput
): Promise<UserNotificationPreferences | null> {
  const { rows } = await db.query<UserNotificationPreferences>(
    `
    UPDATE public.users
    SET
      email_notifications_enabled = $2,
      in_app_notifications_enabled = $3,
      updated_at = NOW(),
      updated_by = $1
    WHERE id = $1
      AND is_active = true
    RETURNING
      id::text AS "userId",
      email,
      COALESCE(email_notifications_enabled, true) AS "emailNotificationsEnabled",
      COALESCE(in_app_notifications_enabled, true) AS "inAppNotificationsEnabled",
      updated_at AS "updatedAt"
    `,
    [
      input.userId,
      input.emailNotificationsEnabled,
      input.inAppNotificationsEnabled,
    ]
  );

  return rows[0] ?? null;
}

/**
 * Future notification services should use this helper before creating
 * delivery records or sending messages.
 */
export async function userAllowsNotificationChannel(input: {
  userId: string;
  channel: "email" | "in_app";
}): Promise<boolean> {
  const prefs = await getUserNotificationPreferences(input.userId);
  if (!prefs) return false;

  if (input.channel === "email") {
    return Boolean(prefs.email && prefs.emailNotificationsEnabled);
  }

  return prefs.inAppNotificationsEnabled;
}