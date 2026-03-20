import { db } from "@/lib/db";

/**
 * Simple user repository helpers. These are scoped to Knit QC needs and
 * should not be used for authentication or other security sensitive
 * operations. The functions here expose a subset of user fields for
 * dropdown lists and lookups.
 */

export type UserSummary = {
  id: string;
  displayName: string | null;
  employeeNumber: number | null;
  department: string | null;
  isActive: boolean;
};

/**
 * Returns a list of users filtered by department. Only active users
 * (is_active = true) are returned. The result set is ordered by
 * display name then by employee number to give a consistent user list.
 *
 * @param dept The department name to match (case insensitive). A
 *   partial match is applied (e.g. "Knit" will match "Knit", "Knit
 *   Production" etc.).
 */
export async function listUsersByDepartment(dept: string): Promise<{
  id: string;
  displayName: string | null;
  employeeNumber: number | null;
}[]> {
  const deptFilter = String(dept ?? "").trim();
  if (!deptFilter) return [];
  const params: any[] = [];
  params.push(`${deptFilter}%`);
  const { rows } = await db.query<UserSummary>(
    `SELECT
      id,
      display_name AS "displayName",
      employee_number AS "employeeNumber",
      department,
      is_active AS "isActive"
    FROM public.users
    WHERE is_active IS TRUE
      AND department ILIKE $1
    ORDER BY display_name NULLS LAST, employee_number NULLS LAST`
  , params);

  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    employeeNumber: r.employeeNumber,
  }));
}