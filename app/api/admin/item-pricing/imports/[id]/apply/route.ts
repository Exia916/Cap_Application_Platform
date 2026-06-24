// app/api/admin/item-pricing/imports/[id]/apply/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { applyItemPricingImportBatch } from "@/lib/repositories/itemPricingImportRepo";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const result = await applyItemPricingImportBatch(
      withAudit({ ...body, batchId: id }, auth!)
    );
    return NextResponse.json(result);
  } catch (err) {
    return errorJson(err, "Failed to apply item pricing import.");
  }
}
