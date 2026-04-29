import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getNextSuggestedSalesOrderNumber } from "@/lib/repositories/designWorkflowRepo";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const nextSalesOrderNumber = await getNextSuggestedSalesOrderNumber(
      async <T = any>(sql: string, params?: any[]) => {
        const result = await db.query(sql, params);

        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? 0,
        };
      }
    );

    return NextResponse.json({ nextSalesOrderNumber });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Failed to generate next sales order number.",
      },
      { status: 500 }
    );
  }
}