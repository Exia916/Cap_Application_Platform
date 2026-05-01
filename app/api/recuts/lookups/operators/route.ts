import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type OperatorRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  employeeNumber: number | null;
  department: string | null;
  role: string | null;
};

type Resp = { rows: OperatorRow[] } | { error: string };

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "USER",
  "WAREHOUSE",
]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }

  if (!roleOk((auth as any).role)) {
    return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { rows } = await db.query<OperatorRow>(
      `
      SELECT
        id,
        username,
        display_name AS "displayName",
        name,
        employee_number AS "employeeNumber",
        department,
        role
      FROM public.users
      WHERE COALESCE(is_active, true) = true
        AND UPPER(TRIM(role)) = 'USER'
      ORDER BY
        COALESCE(NULLIF(TRIM(display_name), ''), NULLIF(TRIM(name), ''), username) ASC,
        username ASC
      `
    );

    return NextResponse.json<Resp>({ rows }, { status: 200 });
  } catch (err) {
    console.error("recut operators lookup GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}
