import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import {
  createItemPricingValidationRun,
  listItemPricingValidationRuns,
} from "@/lib/repositories/itemPricingValidationRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const sp = req.nextUrl.searchParams;
    const result = await listItemPricingValidationRuns({
      priceBookId: sp.get("priceBookId"),
      q: sp.get("q"),
      limit: sp.get("limit"),
      offset: sp.get("offset"),
      sortBy: sp.get("sortBy"),
      sortDir: sp.get("sortDir"),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return errorJson(err, "Failed to load validation runs.", 500);
  }
}

export async function POST(req: NextRequest) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await createItemPricingValidationRun(withAudit(body, auth!));
    return NextResponse.json(result);
  } catch (err: any) {
    return errorJson(err, "Failed to create validation run.");
  }
}
