import { db } from "@/lib/db";

export type UserRow = {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  password_hash: string;
  employee_number: number;
  role: string;
  shift: string;
  department: string;
  is_active: boolean;

  email_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
  manager_user_id: string | null;
  last_login_at: string | null;
};

const baseSelect = `
  SELECT
    id,
    username,
    email,
    display_name,
    password_hash,
    employee_number,
    role,
    shift,
    department,
    is_active,
    COALESCE(email_notifications_enabled, true) AS email_notifications_enabled,
    COALESCE(in_app_notifications_enabled, true) AS in_app_notifications_enabled,
    manager_user_id,
    last_login_at
  FROM public.users
`;

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    `
    ${baseSelect}
    WHERE username = $1
    LIMIT 1
    `,
    [username.trim()]
  );

  return rows[0] ?? null;
}

export async function getUserByEmployeeNumber(
  employeeNumber: number
): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    `
    ${baseSelect}
    WHERE employee_number = $1
    LIMIT 1
    `,
    [employeeNumber]
  );

  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    `
    ${baseSelect}
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

/**
 * Phase 1 notification plumbing:
 * Tracks the last successful username/password authentication.
 *
 * Note:
 * For offsite security-question enforcement, this marks successful primary
 * authentication. If you later want last_login_at to mean "fully completed
 * post-security-question login", also call this helper after the security
 * question challenge succeeds.
 */
export async function markUserLoginSuccess(userId: string): Promise<void> {
  await db.query(
    `
    UPDATE public.users
    SET last_login_at = NOW()
    WHERE id = $1
    `,
    [userId]
  );
}