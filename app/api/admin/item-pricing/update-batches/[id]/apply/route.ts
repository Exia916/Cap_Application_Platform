// app/api/admin/item-pricing/update-batches/[id]/apply/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { applyItemPricingUpdateBatch } from "@/lib/repositories/itemPricingUpdateRepo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function routeId(ctx: Ctx) {
  return (await ctx.params).id;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await applyItemPricingUpdateBatch(withAudit({ ...body, batchId: await routeId(ctx) }, auth!));
    return NextResponse.json(result);
  } catch (err) {
    return errorJson(err, "Failed to apply item pricing update batch.");
  }
}
