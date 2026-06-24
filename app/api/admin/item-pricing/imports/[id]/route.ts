// app/api/admin/item-pricing/imports/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { getItemPricingImportBatch } from "@/lib/repositories/itemPricingImportRepo";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const { id } = await context.params;
    const result = await getItemPricingImportBatch(id);
    if (!result) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return errorJson(err, "Failed to load item pricing import batch.");
  }
}
