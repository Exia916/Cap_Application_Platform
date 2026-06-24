// app/api/admin/item-pricing/import-template/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { ITEM_PRICING_IMPORT_TEMPLATE_CSV } from "@/lib/itemPricing/itemPricingCsvImportService";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  return new NextResponse(ITEM_PRICING_IMPORT_TEMPLATE_CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="item-pricing-import-template.csv"',
    },
  });
}
