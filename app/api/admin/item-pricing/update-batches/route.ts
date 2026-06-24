// app/api/admin/item-pricing/update-batches/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { createItemPricingUpdateBatch, listItemPricingUpdateBatches } from "@/lib/repositories/itemPricingUpdateRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  const { searchParams } = new URL(req.url);

  try {
    const result = await listItemPricingUpdateBatches({
      q: searchParams.get("q"),
      priceBookId: searchParams.get("priceBookId"),
      status: searchParams.get("status"),
      sortBy: searchParams.get("sortBy"),
      sortDir: searchParams.get("sortDir") || "desc",
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorJson(err, "Failed to load item pricing update batches.");
  }
}

export async function POST(req: NextRequest) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json();
    const result = await createItemPricingUpdateBatch(withAudit(body, auth!));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorJson(err, "Failed to create item pricing update batch.");
  }
}
