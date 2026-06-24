// app/api/admin/item-pricing/lookups/decoration-methods/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { listItemPricingDecorationMethods } from "@/lib/repositories/itemPricingRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const rows = await listItemPricingDecorationMethods();
    return NextResponse.json({ rows, total: rows.length });
  } catch (err: any) {
    return errorJson(err, "Failed to load item pricing decoration methods.", 500);
  }
}
