import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { duplicateItemPricingPriceBook } from "@/lib/repositories/itemPricingHardeningRepo";

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
    const created = await duplicateItemPricingPriceBook(
      withAudit({ ...body, sourcePriceBookId: await routeId(ctx) }, auth!)
    );
    return NextResponse.json(created);
  } catch (err: any) {
    return errorJson(err, "Failed to duplicate price book.");
  }
}
