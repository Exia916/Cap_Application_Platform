import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q");
  const params: any[] = [];
  let where = `WHERE is_active = true`;

  if (q?.trim()) {
    params.push(`%${q.trim()}%`);
    where += ` AND code ILIKE $1`;
  }

  try {
    const { rows } = await db.query<{
      id: number;
      code: string;
      description: string | null;
    }>(
      `
      SELECT
        id,
        code,
        description
      FROM public.design_workflow_bins
      ${where}
      ORDER BY sort_order ASC, code ASC
      LIMIT 100
      `,
      params
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load bins lookup." },
      { status: 500 }
    );
  }
}