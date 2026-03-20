// app/api/sales-orders/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getSalesOrder, SalesOrderLookupError } from "@/lib/integrations/sbt/getSalesOrder";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const so = (searchParams.get("so") || "").trim();

  try {
    const result = await getSalesOrder(so);

    return NextResponse.json({
      success: true,
      salesOrderBase: result.salesOrderBase,
      salesOrderDisplay: result.salesOrderDisplay,
      requestedSalesOrder: result.requestedSalesOrder,
      printUrl: `/sales-orders/${encodeURIComponent(result.salesOrderBase)}/print`,
      data: result.data,
    });
  } catch (error) {
    if (error instanceof SalesOrderLookupError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unexpected error while looking up the Sales Order." },
      { status: 500 }
    );
  }
}