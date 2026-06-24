// app/api/admin/item-pricing/price-levels/[id]/rules/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { createItemPricingPriceLevelRule, listItemPricingPriceLevelRules } from "@/lib/repositories/itemPricingPriceLevelRepo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function routeId(ctx: Ctx) {
  return (await ctx.params).id;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  const { searchParams } = new URL(req.url);

  try {
    const rows = await listItemPricingPriceLevelRules(await routeId(ctx), {
      includeInactive: searchParams.get("includeInactive"),
    });
    return NextResponse.json({ rows, total: rows.length });
  } catch (err: any) {
    return errorJson(err, "Failed to load price level rules.", 500);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json();
    const created = await createItemPricingPriceLevelRule(await routeId(ctx), withAudit(body, auth!));
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return errorJson(err, "Failed to create price level rule.");
  }
}
