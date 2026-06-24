import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { createItemPricingPriceBook } from "@/lib/repositories/itemPricingRepo";
import { listItemPricingPriceBooksForHardening } from "@/lib/repositories/itemPricingHardeningRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const sp = req.nextUrl.searchParams;
    const result = await listItemPricingPriceBooksForHardening({
      q: sp.get("q"),
      limit: sp.get("limit"),
      offset: sp.get("offset"),
      sortBy: sp.get("sortBy"),
      sortDir: sp.get("sortDir"),
      includeVoided: sp.get("includeVoided"),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return errorJson(err, "Failed to load price books.", 500);
  }
}

export async function POST(req: NextRequest) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json();
    const created = await createItemPricingPriceBook(withAudit(body, auth!));
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return errorJson(err, "Failed to create price book.");
  }
}
