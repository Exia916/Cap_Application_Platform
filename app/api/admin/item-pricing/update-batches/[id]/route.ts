// app/api/admin/item-pricing/update-batches/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { getItemPricingUpdateBatch } from "@/lib/repositories/itemPricingUpdateRepo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function routeId(ctx: Ctx) {
  return (await ctx.params).id;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const row = await getItemPricingUpdateBatch(await routeId(ctx));
    if (!row) return NextResponse.json({ error: "Update batch not found." }, { status: 404 });
    return NextResponse.json(row);
  } catch (err: any) {
    return errorJson(err, "Failed to load item pricing update batch.", 500);
  }
}
