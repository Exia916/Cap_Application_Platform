import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const department = req.nextUrl.searchParams.get("department")?.trim();

  const params: any[] = [];
  const where: string[] = [`is_active = true`];

  if (department) {
    params.push(department);
    where.push(`department ILIKE $${params.length}`);
  }

  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(display_name ILIKE $${params.length} OR username ILIKE $${params.length})`
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const { rows } = await db.query<{
      id: string;
      name: string;
      username: string;
      role: string;
      employeeNumber: number | null;
      shift: string | null;
      department: string | null;
    }>(
      `
      SELECT
        id,
        display_name AS name,
        username,
        role,
        employee_number AS "employeeNumber",
        shift,
        department
      FROM public.users
      ${whereSql}
      ORDER BY display_name ASC, username ASC
      LIMIT 100
      `,
      params
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load users lookup." },
      { status: 500 }
    );
  }
}