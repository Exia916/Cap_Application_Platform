// lib/repositories/quickTurnQuoteCalculatorUserRepo.ts

import { db } from "@/lib/db";

export type QuickTurnOverseasCustomerServiceUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  employeeNumber: number | null;
  department: string | null;
};

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function cleanOptionalUuid(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function overseasCsDepartmentWhere(alias = "department") {
  return `REPLACE(REPLACE(UPPER(COALESCE(${alias}, '')), '_', ' '), '-', ' ') IN ('OVERSEAS CUSTOMER SERVICE', 'OVERSEAS CS')`;
}

const OVERSEAS_CS_USER_SELECT = `
  id::text AS id,
  username,
  COALESCE(NULLIF(display_name, ''), NULLIF(name, ''), username) AS "displayName",
  email,
  employee_number AS "employeeNumber",
  department
`;

export async function listQuickTurnOverseasCustomerServiceUsers(
  q?: string | null
): Promise<QuickTurnOverseasCustomerServiceUser[]> {
  const search = cleanText(q);
  const params: any[] = [];
  const where = ["COALESCE(is_active, false) = true", overseasCsDepartmentWhere()];

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    where.push(
      `(display_name ILIKE $${idx} OR name ILIKE $${idx} OR username ILIKE $${idx} OR email ILIKE $${idx} OR employee_number::text ILIKE $${idx})`
    );
  }

  const { rows } = await db.query<QuickTurnOverseasCustomerServiceUser>(
    `
    SELECT ${OVERSEAS_CS_USER_SELECT}
    FROM public.users
    WHERE ${where.join(" AND ")}
    ORDER BY COALESCE(NULLIF(display_name, ''), NULLIF(name, ''), username) ASC
    LIMIT 100
    `,
    params
  );

  return rows;
}

export async function getActiveQuickTurnOverseasCustomerServiceUserById(
  id: string | null | undefined
): Promise<QuickTurnOverseasCustomerServiceUser | null> {
  const userId = cleanOptionalUuid(id);
  if (!userId) return null;

  const { rows } = await db.query<QuickTurnOverseasCustomerServiceUser>(
    `
    SELECT ${OVERSEAS_CS_USER_SELECT}
    FROM public.users
    WHERE id = $1::uuid
      AND COALESCE(is_active, false) = true
      AND ${overseasCsDepartmentWhere()}
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}
