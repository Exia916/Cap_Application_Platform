// app/api/admin/item-pricing/price-levels/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { createItemPricingPriceLevel, listItemPricingPriceLevels } from "@/lib/repositories/itemPricingPriceLevelRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  const { searchParams } = new URL(req.url);

  try {
    const result = await listItemPricingPriceLevels({
      q: searchParams.get("q"),
      includeInactive: searchParams.get("includeInactive"),
      sortBy: searchParams.get("sortBy"),
      sortDir: searchParams.get("sortDir"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return errorJson(err, "Failed to load item pricing price levels.", 500);
  }
}

export async function POST(req: NextRequest) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json();
    const created = await createItemPricingPriceLevel(withAudit(body, auth!));
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return errorJson(err, "Failed to create price level.");
  }
}
