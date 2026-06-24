// app/api/admin/item-pricing/exports/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { errorJson, requireItemPricingAuth } from "@/app/api/admin/item-pricing/_shared";
import { getItemPricingExportRun } from "@/lib/repositories/itemPricingExportRepo";

export const runtime = "nodejs";

function safeFileName(name: string | null | undefined) {
  const clean = String(name || "item-pricing-export")
    .replace(/[\\/\r\n\t]+/g, "-")
    .replace(/"/g, "'")
    .trim();
  return clean || "item-pricing-export";
}

export async function GET(req: NextRequest) {
  const { response } = await requireItemPricingAuth(req, "view");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  try {
    if (!id) return NextResponse.json({ error: "Export run id is required." }, { status: 400 });

    const run = await getItemPricingExportRun(id, true);
    if (!run) {
      return NextResponse.json({ error: "Export run not found." }, { status: 404 });
    }

    if (String(run.fileFormat).toUpperCase() === "PDF") {
      if (!run.pdfContentBase64) {
        return NextResponse.json({ error: "PDF content is not available." }, { status: 404 });
      }

      const bytes = Buffer.from(run.pdfContentBase64, "base64");
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFileName(run.fileName)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (!run.csvContent) {
      return NextResponse.json({ error: "CSV content is not available." }, { status: 404 });
    }

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
