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
    is_active
  FROM users
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
