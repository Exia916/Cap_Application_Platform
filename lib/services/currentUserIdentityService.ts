import { db } from "@/lib/db";

export type CurrentUserIdentity = {
  publicUserId: string | null;
  username: string | null;
  displayName: string | null;
  employeeNumber: number | null;
  role: string | null;
  department: string | null;
};

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

function authEmployeeNumber(auth: any) {
  const raw = auth?.employeeNumber ?? auth?.employee_number ?? auth?.userId ?? null;
  const empNum = Number(raw);

  return Number.isFinite(empNum) ? Math.trunc(empNum) : null;
}

function authDisplayName(auth: any) {
  return (
    cleanString(auth?.displayName) ||
    cleanString(auth?.name) ||
    cleanString(auth?.username) ||
    null
  );
}

export async function resolveCurrentUserIdentity(
  auth: any,
): Promise<CurrentUserIdentity> {
  const idCandidate = cleanString(auth?.id);
  const username = cleanString(auth?.username);
  const employeeNumber = authEmployeeNumber(auth);

  if (isUuid(idCandidate)) {
    return {
      publicUserId: idCandidate,
      username: username || null,
      displayName: authDisplayName(auth),
      employeeNumber,
      role: cleanString(auth?.role) || null,
      department: cleanString(auth?.department) || null,
    };
  }

  if (!username && employeeNumber == null) {
    return {
      publicUserId: null,
      username: null,
      displayName: authDisplayName(auth),
      employeeNumber,
      role: cleanString(auth?.role) || null,
      department: cleanString(auth?.department) || null,
    };
  }

  const { rows } = await db.query<{
    id: string;
    username: string | null;
    displayName: string | null;
    employeeNumber: number | null;
    role: string | null;
    department: string | null;
  }>(
    `
    SELECT
      u.id::text AS "id",
      u.username,
      u.display_name AS "displayName",
      u.employee_number AS "employeeNumber",
      u.role,
      u.department
    FROM public.users u
    WHERE
      ($1 <> '' AND u.username = $1)
      OR ($2::int IS NOT NULL AND u.employee_number = $2::int)
    ORDER BY u.is_active DESC, u.display_name ASC NULLS LAST
    LIMIT 1
    `,
    [username, employeeNumber],
  );

  const row = rows[0] ?? null;

  return {
    publicUserId: row?.id ?? null,
    username: (row?.username ?? username) || null,
    displayName: row?.displayName ?? authDisplayName(auth),
    employeeNumber: row?.employeeNumber ?? employeeNumber,
    role: (row?.role ?? cleanString(auth?.role)) || null,
    department: (row?.department ?? cleanString(auth?.department)) || null,
  };
}