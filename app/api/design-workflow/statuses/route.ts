import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { rows } = await db.query<{
      id: number;
      code: string;
      label: string;
      sort_order: number;
    }>(
      `
      SELECT
        id,
        code,
        label,
        sort_order
      FROM public.design_workflow_statuses
      WHERE COALESCE(is_active, true) = true
      ORDER BY sort_order ASC, label ASC
      `
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", {
      status: 500,
    });
  }
}