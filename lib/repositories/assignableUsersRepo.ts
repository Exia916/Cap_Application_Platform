import { db } from "@/lib/db";

export type AssignableUserRow = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  employeeNumber: number | null;
  role: string | null;
  shift: string | null;
  department: string | null;
  managerUserId: string | null;
  managerDisplayName: string | null;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
};

export type ListAssignableUsersArgs = {
  q?: string | null;
  department?: string | null;
  role?: string | null;
  limit?: number | null;
};

function toSafeLimit(value: unknown, fallback = 100, max = 250) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

export async function listAssignableUsers(
  args: ListAssignableUsersArgs = {}
): Promise<AssignableUserRow[]> {
  const params: any[] = [];
  const where: string[] = [];

  where.push(`u.is_active = true`);

  const q = String(args.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    where.push(`
      (
        u.display_name ILIKE $${params.length}
        OR u.name ILIKE $${params.length}
        OR u.username ILIKE $${params.length}
        OR u.email ILIKE $${params.length}
        OR CAST(u.employee_number AS text) ILIKE $${params.length}
      )
    `);
  }

  const department = String(args.department ?? "").trim();
  if (department) {
    params.push(department);
    where.push(`u.department ILIKE $${params.length}`);
  }

  const role = String(args.role ?? "").trim().toUpperCase();
  if (role) {
    params.push(role);
    where.push(`UPPER(u.role) = $${params.length}`);
  }

  const limit = toSafeLimit(args.limit);

  params.push(limit);
  const limitParam = `$${params.length}`;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await db.query<AssignableUserRow>(
    `
    SELECT
      u.id::text AS "id",
      u.username,
      u.display_name AS "displayName",
      u.email,
      u.employee_number AS "employeeNumber",
      u.role,
      u.shift,
      u.department,
      u.manager_user_id::text AS "managerUserId",
      mgr.display_name AS "managerDisplayName",
      COALESCE(u.email_notifications_enabled, true) AS "emailNotificationsEnabled",
      COALESCE(u.in_app_notifications_enabled, true) AS "inAppNotificationsEnabled"
    FROM public.users u
    LEFT JOIN public.users mgr ON mgr.id = u.manager_user_id
    ${whereSql}
    ORDER BY
      u.display_name ASC NULLS LAST,
      u.username ASC
    LIMIT ${limitParam}
    `,
    params
  );

  return rows;
}

export async function getAssignableUserById(
  id: string
): Promise<AssignableUserRow | null> {
  const { rows } = await db.query<AssignableUserRow>(
    `
    SELECT
      u.id::text AS "id",
      u.username,
      u.display_name AS "displayName",
      u.email,
      u.employee_number AS "employeeNumber",
      u.role,
      u.shift,
      u.department,
      u.manager_user_id::text AS "managerUserId",
      mgr.display_name AS "managerDisplayName",
      COALESCE(u.email_notifications_enabled, true) AS "emailNotificationsEnabled",
      COALESCE(u.in_app_notifications_enabled, true) AS "inAppNotificationsEnabled"
    FROM public.users u
    LEFT JOIN public.users mgr ON mgr.id = u.manager_user_id
    WHERE u.id = $1
      AND u.is_active = true
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}