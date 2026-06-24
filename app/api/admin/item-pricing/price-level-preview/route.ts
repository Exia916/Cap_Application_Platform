// app/api/admin/item-pricing/price-level-preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { calculateItemPricingPriceLevelPreview } from "@/lib/repositories/itemPricingPriceLevelRepo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "preview");
  if (response) return response;

  try {
    const body = await req.json();
    const result = await calculateItemPricingPriceLevelPreview(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return errorJson(err, "Failed to calculate price level preview.");
  }
}
