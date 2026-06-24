import { NextRequest, NextResponse } from "next/server";
import {
  errorJson,
  requireItemPricingAuth,
  withAudit,
} from "@/app/api/admin/item-pricing/_shared";
import {
  createItemPricingItem,
  listItemPricingItems,
} from "@/lib/repositories/itemPricingRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  const sp = req.nextUrl.searchParams;

  try {
    const rows = await listItemPricingItems({
      q: sp.get("q"),
      priceBookId: sp.get("priceBookId"),
      ruleSetId: sp.get("ruleSetId"),
      includeInactive: sp.get("includeInactive"),
      includeVoided: sp.get("includeVoided"),
      sortBy: sp.get("sortBy"),
      sortDir: sp.get("sortDir"),
      limit: sp.get("limit"),
      offset: sp.get("offset"),
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return errorJson(err, "Failed to load item pricing items.", 500);
  }
}

export async function POST(req: NextRequest) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json();
    const created = await createItemPricingItem(withAudit(body, auth!));
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return errorJson(err, "Failed to create item pricing item.");
  }
}
