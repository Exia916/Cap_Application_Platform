import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { updateItemPricingPriceBook } from "@/lib/repositories/itemPricingRepo";
import { getItemPricingPriceBookForHardening } from "@/lib/repositories/itemPricingHardeningRepo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function routeId(ctx: Ctx) {
  return (await ctx.params).id;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const row = await getItemPricingPriceBookForHardening(await routeId(ctx));
    if (!row) return NextResponse.json({ error: "Price book not found." }, { status: 404 });
    return NextResponse.json(row);
  } catch (err: any) {
    return errorJson(err, "Failed to load price book.", 500);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json();
    const updated = await updateItemPricingPriceBook(await routeId(ctx), withAudit(body, auth!));
    return NextResponse.json(updated);
  } catch (err: any) {
    return errorJson(err, "Failed to update price book.");
  }
}
