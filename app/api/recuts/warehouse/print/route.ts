import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getRecutRequestsByIds,
  markRecutRequestsPrinted,
  type RecutRequestRow,
} from "@/lib/repositories/recutRepo";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { logAuditEvent, logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "WAREHOUSE"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

function formatDate(value: string | null | undefined) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, 10) : "";
}

function formatTime(value: string | null | undefined) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, 8) : "";
}

function barcodeValue(salesOrder: string) {
  return `*${salesOrder}*`;
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function parseSalesOrderNumber(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{7})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function drawWrappedText(
  page: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: any,
  size: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width <= maxWidth) current = test;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  let yy = y;
  for (const line of lines.slice(0, 4)) {
    page.drawText(line, { x, y: yy, size, font, color: rgb(0.07, 0.1, 0.15) });
    yy -= size + 3;
  }
}

function drawLabelValue(
  page: any,
  opts: {
    x: number;
    y: number;
    label: string;
    value: string;
    labelFont: any;
    valueFont: any;
    labelSize?: number;
    valueSize?: number;
    valueColor?: any;
  }
) {
  const {
    x,
    y,
    label,
    value,
    labelFont,
    valueFont,
    labelSize = 9,
    valueSize = 11,
    valueColor = rgb(0.07, 0.1, 0.15),
  } = opts;

  page.drawText(label, {
    x,
    y,
    size: labelSize,
    font: labelFont,
    color: rgb(0.36, 0.4, 0.46),
  });

  page.drawText(value || "-", {
    x,
    y: y - 13,
    size: valueSize,
    font: valueFont,
    color: valueColor,
  });
}

function drawTicket(
  page: any,
  row: RecutRequestRow,
  fonts: { regular: any; bold: any; barcode: any },
  box: { x: number; y: number; w: number; h: number }
) {
  const { regular, bold, barcode } = fonts;
  const { x, y, w, h } = box;

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderWidth: 1.25,
    borderColor: rgb(0.82, 0.84, 0.88),
    color: rgb(1, 1, 1),
  });

  page.drawText("CAP AMERICA | RECUT PICK TICKET", {
    x: x + 14,
    y: y + h - 24,
    size: 14,
    font: bold,
    color: rgb(0.07, 0.1, 0.15),
  });

  page.drawText(`Recut ID: ${row.recutId}`, {
    x: x + w - 125,
    y: y + h - 22,
    size: 11,
    font: bold,
    color: rgb(0.07, 0.1, 0.15),
  });

  page.drawText(`Requested: ${formatDate(row.requestedDate)} ${formatTime(row.requestedTime)}`.trim(), {
    x: x + 14,
    y: y + h - 42,
    size: 10,
    font: regular,
    color: rgb(0.36, 0.4, 0.46),
  });

  let topY = y + h - 70;
  const leftX = x + 14;
  const rightX = x + w / 2 + 8;

  drawLabelValue(page, {
    x: leftX,
    y: topY,
    label: "Requested By",
    value: safeText(row.requestedByName),
    labelFont: bold,
    valueFont: regular,
  });

  drawLabelValue(page, {
    x: rightX,
    y: topY,
    label: "Requested Department",
    value: safeText(row.requestedDepartment),
    labelFont: bold,
    valueFont: regular,
  });

  topY -= 34;

  drawLabelValue(page, {
    x: leftX,
    y: topY,
    label: "Design Name",
    value: safeText(row.designName),
    labelFont: bold,
    valueFont: regular,
  });

  drawLabelValue(page, {
    x: rightX,
    y: topY,
    label: "Recut Reason",
    value: safeText(row.recutReason),
    labelFont: bold,
    valueFont: regular,
  });

  topY -= 34;

  drawLabelValue(page, {
    x: leftX,
    y: topY,
    label: "Detail #",
    value: String(row.detailNumber),
    labelFont: bold,
    valueFont: regular,
  });

  drawLabelValue(page, {
    x: rightX,
    y: topY,
    label: "Cap Style",
    value: safeText(row.capStyle),
    labelFont: bold,
    valueFont: regular,
  });

  topY -= 34;

  drawLabelValue(page, {
    x: leftX,
    y: topY,
    label: "Pieces",
    value: String(row.pieces),
    labelFont: bold,
    valueFont: regular,
  });

  drawLabelValue(page, {
    x: rightX,
    y: topY,
    label: "Operator",
    value: safeText(row.operator),
    labelFont: bold,
    valueFont: regular,
  });

  topY -= 34;

  drawLabelValue(page, {
    x: leftX,
    y: topY,
    label: "Deliver To",
    value: safeText(row.deliverTo),
    labelFont: bold,
    valueFont: regular,
  });

  drawLabelValue(page, {
    x: rightX,
    y: topY,
    label: "Event",
    value: `${row.event ? "Event" : "No"}`,
    labelFont: bold,
    valueFont: regular,
  });

  topY -= 62;

  page.drawLine({
    start: { x: leftX, y: topY + 24 },
    end: { x: x + w - 14, y: topY + 24 },
    thickness: 1,
    color: rgb(0.9, 0.91, 0.93),
  });

  page.drawText("Sales Order #", {
    x: leftX,
    y: topY + 10,
    size: 10,
    font: bold,
    color: rgb(0.36, 0.4, 0.46),
  });

  page.drawText(safeText(row.salesOrder), {
    x: leftX,
    y: topY - 8,
    size: 13,
    font: bold,
    color: rgb(0.07, 0.1, 0.15),
  });

  page.drawText(barcodeValue(row.salesOrder), {
    x: leftX,
    y: topY - 38,
    size: 34,
    font: barcode,
    color: rgb(0, 0, 0),
  });

  page.drawText(barcodeValue(row.salesOrder), {
    x: leftX,
    y: topY - 58,
    size: 10,
    font: regular,
    color: rgb(0.45, 0.49, 0.55),
  });

  if (row.notes) {
    page.drawText("Notes", {
      x: rightX,
      y: topY + 10,
      size: 10,
      font: bold,
      color: rgb(0.36, 0.4, 0.46),
    });

    drawWrappedText(
      page,
      safeText(row.notes),
      rightX,
      topY - 8,
      w / 2 - 26,
      regular,
      11
    );
  }
}

async function buildPdf(rows: RecutRequestRow[]) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const barcodeFontPath = path.join(process.cwd(), "public", "fonts", "LibreBarcode39-Regular.ttf");
  const barcodeFontBytes = await fs.readFile(barcodeFontPath);
  const barcode = await pdfDoc.embedFont(barcodeFontBytes);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 28;
  const ticketGap = 18;
  const ticketHeight = (pageHeight - margin * 2 - ticketGap) / 2;
  const ticketWidth = pageWidth - margin * 2;

  for (let i = 0; i < rows.length; i += 2) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const first = rows[i];
    const second = rows[i + 1];

    drawTicket(
      page,
      first,
      { regular, bold, barcode },
      { x: margin, y: pageHeight - margin - ticketHeight, w: ticketWidth, h: ticketHeight }
    );

    if (second) {
      drawTicket(
        page,
        second,
        { regular, bold, barcode },
        { x: margin, y: margin, w: ticketWidth, h: ticketHeight }
      );
    }
  }

  return pdfDoc.save();
}

export async function POST(req: NextRequest) {
  let auth: ReturnType<typeof getAuthFromRequest> | null = null;
  let ids: string[] = [];
  let rows: RecutRequestRow[] = [];

  try {
    auth = await getAuthFromRequest(req as any);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_WAREHOUSE_PRINT_FORBIDDEN",
        message: "User attempted to print warehouse recut tickets without permission",
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    ids = Array.isArray(body?.ids) ? body.ids.map((x: unknown) => String(x)).filter(Boolean) : [];

    if (!ids.length) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_WAREHOUSE_PRINT_INVALID",
        message: "Warehouse print request received no selected recut ids",
        details: {
          reason: "NO_IDS_SELECTED",
        },
      });

      return NextResponse.json({ error: "No recut requests selected." }, { status: 400 });
    }

    rows = await getRecutRequestsByIds(ids);

    if (!rows.length) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "RECUT",
        eventType: "RECUT_WAREHOUSE_PRINT_NOT_FOUND",
        message: "Warehouse print request found no matching recut requests",
        recordType: "recut_requests",
        details: {
          requestedIds: ids,
        },
      });

      return NextResponse.json({ error: "No matching recut requests found." }, { status: 404 });
    }

    const pdfBytes = await buildPdf(rows);

    const printedBy = String(
      (auth as any).displayName ?? (auth as any).username ?? "Unknown"
    ).trim();

    await markRecutRequestsPrinted({
      ids: rows.map((r) => r.id),
      printedBy,
    });

    await logAuditEvent({
      req,
      auth,
      module: "RECUT",
      eventType: "RECUT_WAREHOUSE_PRINTED",
      message: "Warehouse recut tickets printed and marked as printed",
      recordType: "recut_requests",
      details: {
        requestedCount: ids.length,
        printedCount: rows.length,
        ids: rows.map((r) => r.id),
        recutIds: rows.map((r) => r.recutId),
        printedBy,
      },
    });

    for (const row of rows) {
      await createActivityHistory({
        entityType: "recut_requests",
        entityId: row.id,
        eventType: "WAREHOUSE_PRINTED",
        fieldName: "warehousePrinted",
        previousValue: !!row.warehousePrinted,
        newValue: true,
        message: "Warehouse ticket printed",
        module: "RECUT",
        userId: (auth as any).userId != null ? String((auth as any).userId) : null,
        userName: printedBy,
        employeeNumber:
          (auth as any).employeeNumber != null ? Number((auth as any).employeeNumber) : null,
        salesOrder: parseSalesOrderNumber(row.salesOrder),
        detailNumber: row.detailNumber,
      });
    }

    return new NextResponse(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="recuts-warehouse-print.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "RECUT",
      eventType: "RECUT_WAREHOUSE_PRINT_ERROR",
      message: "Failed to print warehouse recut tickets",
      recordType: "recut_requests",
      error: err,
      details: {
        requestedIds: ids,
        matchedIds: rows.map((r) => r.id),
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    console.error("recuts warehouse print POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}