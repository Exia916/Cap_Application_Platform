// app/api/admin/item-pricing/exports/[id]/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { getItemPricingExportRun } from "@/lib/repositories/itemPricingExportRepo";

type Params = { params: Promise<{ id: string }> };

function safeFileName(value: string | null | undefined) {
  return String(value || "item-pricing-base-export.csv").replace(/[^A-Za-z0-9._-]+/g, "_");
}

export async function GET(req: NextRequest, { params }: Params) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  try {
    const { id } = await params;
    const run = await getItemPricingExportRun(id, true);
    if (!run) return NextResponse.json({ error: "Export run not found." }, { status: 404 });
    if (!run.csvContent) return NextResponse.json({ error: "Export content is not available." }, { status: 404 });

    return new NextResponse(run.csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName(run.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorJson(err, "Failed to download item pricing export.");
  }
}
