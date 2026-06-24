// app/api/admin/item-pricing/exports/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth, withAudit } from "@/app/api/admin/item-pricing/_shared";
import { generateItemPricingExport, listItemPricingExportRuns } from "@/lib/repositories/itemPricingExportRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  const { searchParams } = new URL(req.url);

  try {
    const result = await listItemPricingExportRuns({
      q: searchParams.get("q"),
      priceBookId: searchParams.get("priceBookId"),
      exportType: searchParams.get("exportType"),
      fileFormat: searchParams.get("fileFormat"),
      sortBy: searchParams.get("sortBy"),
      sortDir: searchParams.get("sortDir") || "desc",
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorJson(err, "Failed to load item pricing export runs.");
  }
}

export async function POST(req: NextRequest) {
  const { auth, response } = await requireItemPricingAuth(req, "edit");
  if (response) return response;

  try {
    const body = await req.json();
    const result = await generateItemPricingExport(withAudit(body, auth!));
    return NextResponse.json({ ...result, csvContent: undefined, pdfContentBase64: undefined }, { status: 201 });
  } catch (err) {
    return errorJson(err, "Failed to generate item pricing export.");
  }
}
