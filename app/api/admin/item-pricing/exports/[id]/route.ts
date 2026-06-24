// app/api/admin/item-pricing/exports/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { getItemPricingExportRun } from "@/lib/repositories/itemPricingExportRepo";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const { id } = await params;
    const run = await getItemPricingExportRun(id, false);
    if (!run) return NextResponse.json({ error: "Export run not found." }, { status: 404 });
    return NextResponse.json(run);
  } catch (err) {
    return errorJson(err, "Failed to load item pricing export run.");
  }
}
