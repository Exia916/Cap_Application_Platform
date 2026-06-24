import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { updateItemPricingPriceBookLifecycle } from "@/lib/repositories/itemPricingHardeningRepo";

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
    const updated = await updateItemPricingPriceBookLifecycle(
      withAudit({ ...body, id: await routeId(ctx) }, auth!)
    );
    return NextResponse.json(updated);
  } catch (err: any) {
    return errorJson(err, "Failed to update price book status.");
  }
}
