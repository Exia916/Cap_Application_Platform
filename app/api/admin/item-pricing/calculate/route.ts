import { NextRequest, NextResponse } from "next/server";
import {
  errorJson,
  requireItemPricingAuth,
  withAudit,
} from "@/app/api/admin/item-pricing/_shared";
import { calculateItemPricingPreview } from "@/lib/repositories/itemPricingRepo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { auth, response } = await requireItemPricingAuth(req, "preview");
  if (response) return response;

  try {
    const body = await req.json();
    const result = await calculateItemPricingPreview(withAudit(body, auth!));
    return NextResponse.json(result);
  } catch (err: any) {
    return errorJson(err, "Failed to calculate item pricing preview.");
  }
}
