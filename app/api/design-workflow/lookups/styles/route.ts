import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = getAuthFromRequest(req);

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 75);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 150)
      : 75;

    const params: any[] = [];
    const where: string[] = [`is_active = true`];

    let orderSql = `
      ORDER BY
        sort_order ASC,
        item_code ASC
    `;

    if (q) {
      params.push(`${q}%`);
      const startsWithParam = `$${params.length}`;

      params.push(`%${q}%`);
      const containsParam = `$${params.length}`;

      where.push(`
        (
          item_code ILIKE ${startsWithParam}
          OR COALESCE(description, '') ILIKE ${containsParam}
        )
      `);

      orderSql = `
        ORDER BY
          CASE
            WHEN item_code ILIKE ${startsWithParam} THEN 0
            ELSE 1
          END,
          sort_order ASC,
          item_code ASC
      `;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const { rows } = await db.query<{
      id: string;
      code: string;
      description: string | null;
    }>(
      `
      SELECT
        id::text AS id,
        item_code AS code,
        description
      FROM public.recut_items
      WHERE ${where.join(" AND ")}
      ${orderSql}
      LIMIT ${limitParam}
      `,
      params
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", {
      status: 500,
    });
  }
}