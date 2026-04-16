import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const params: any[] = [];
  let where = `WHERE is_active = true`;

  if (q) {
    params.push(`%${q}%`);
    params.push(`%${q}%`);
    where += ` AND (code ILIKE $1 OR name ILIKE $2)`;
  }

  try {
    const { rows } = await db.query<{
      id: number;
      code: string;
      name: string;
    }>(
      `
      SELECT
        id,
        code,
        name
      FROM public.design_workflow_customers
      ${where}
      ORDER BY sort_order ASC, name ASC, code ASC
      LIMIT 200
      `,
      params
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load customers lookup." },
      { status: 500 }
    );
  }
}