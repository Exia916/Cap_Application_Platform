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
      (sql, params) => db.query(sql, params)
    );

    return NextResponse.json({ nextSalesOrderNumber });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to generate next sales order number." },
      { status: 500 }
    );
  }
}
