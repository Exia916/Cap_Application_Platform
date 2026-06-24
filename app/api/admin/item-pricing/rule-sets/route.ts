import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import {
  listItemPricingDecorationMethods,
  listItemPricingQuantityBreaks,
  listItemPricingRuleSets,
} from "@/lib/repositories/itemPricingRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  const sp = req.nextUrl.searchParams;

  try {
    const [rows, decorationMethods, quantityBreaks] = await Promise.all([
      listItemPricingRuleSets({
        q: sp.get("q"),
        includeInactive: sp.get("includeInactive"),
      }),
      listItemPricingDecorationMethods(),
      listItemPricingQuantityBreaks(),
    ]);

    return NextResponse.json({ rows, decorationMethods, quantityBreaks });
  } catch (err: any) {
    return errorJson(err, "Failed to load rule sets.", 500);
  }
}
