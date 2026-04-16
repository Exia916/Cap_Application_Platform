import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const params: any[] = [];
  let where = `WHERE is_active = true`;

  if (q) {
    params.push(`%${q}%`);
    params.push(`%${q}%`);
    where += ` AND (code ILIKE $1 OR COALESCE(description, '') ILIKE $2)`;
  }

  try {
    const { rows } = await db.query<{
      id: number;
      code: string;
      description: string | null;
    }>(
      `
      SELECT id, code, description
      FROM public.design_workflow_styles
      ${where}
      ORDER BY sort_order ASC, code ASC
      LIMIT 200
      `,
      params
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}