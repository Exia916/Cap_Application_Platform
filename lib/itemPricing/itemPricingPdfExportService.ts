// lib/itemPricing/itemPricingPdfExportService.ts

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { itemPricingMethodLabel, itemPricingQuantityBreakLabel } from "@/lib/itemPricing/constants";
import type { ItemPricingCalculationResult } from "@/lib/itemPricing/types";
import type { ItemPricingExportFilters } from "@/lib/itemPricing/exportTypes";

type ExportableCalculation = ItemPricingCalculationResult & { fatalError?: string | null };

type PdfFontSet = {
  regular: any;
  bold: any;
};

type PdfPriceBook = {
  id: string;
  code: string;
  name: string;
};

type PdfBuildInput = {
  priceBook: PdfPriceBook;
  results: ExportableCalculation[];
  filters?: ItemPricingExportFilters | null;
  generatedBy?: string | null;
};

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 36;
const TEXT = rgb(0.07, 0.1, 0.15);
const SOFT = rgb(0.38, 0.42, 0.48);
const BORDER = rgb(0.84, 0.86, 0.9);
const MUTED_BG = rgb(0.96, 0.97, 0.98);
const WARNING_BG = rgb(1, 0.98, 0.9);
const DANGER_BG = rgb(1, 0.94, 0.94);

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(2);
}

function safeText(value: unknown, fallback = "—") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function dateTimeLabel(date = new Date()) {
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function methodCode(method: unknown): string {
  const raw = method as { methodCode?: unknown; decorationMethodCode?: unknown } | null | undefined;
  return String(raw?.methodCode ?? raw?.decorationMethodCode ?? "").trim().toUpperCase();
}

function methodOrder(code: string) {
  const order = ["BLANK", "FLAT_EMB", "THREE_D_EMB", "KNIT_IN"];
  const idx = order.indexOf(code);
  return idx === -1 ? 99 : idx;
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawText(
  page: any,
  text: string,
  opts: {
    x: number;
    y: number;
    font: any;
    size: number;
    color?: any;
    maxWidth?: number;
    maxLines?: number;
  }
) {
  const lines = opts.maxWidth ? wrapText(text, opts.font, opts.size, opts.maxWidth) : String(text || "").split("\n");
  let y = opts.y;
  for (const line of lines.slice(0, opts.maxLines ?? lines.length)) {
    page.drawText(line, {
      x: opts.x,
      y,
      size: opts.size,
      font: opts.font,
      color: opts.color ?? TEXT,
    });
    y -= opts.size + 4;
  }
  return y;
}

function addPage(pdfDoc: PDFDocument, fonts: PdfFontSet, pageNumber: number, title = "CAP Item Pricing") {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - 24,
    size: 8,
    font: fonts.bold,
    color: SOFT,
  });
  page.drawText(`Page ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN - 40,
    y: 18,
    size: 8,
    font: fonts.regular,
    color: SOFT,
  });
  return page;
}

function drawHeader(page: any, fonts: PdfFontSet, title: string, subtitle: string, generatedBy?: string | null) {
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_HEIGHT - 58,
    size: 20,
    font: fonts.bold,
    color: TEXT,
  });
  drawText(page, subtitle, {
    x: MARGIN,
    y: PAGE_HEIGHT - 76,
    size: 9,
    font: fonts.regular,
    color: SOFT,
    maxWidth: PAGE_WIDTH - MARGIN * 2 - 180,
    maxLines: 2,
  });
  page.drawText(`Generated: ${dateTimeLabel()}`, {
    x: PAGE_WIDTH - MARGIN - 170,
    y: PAGE_HEIGHT - 58,
    size: 8,
    font: fonts.regular,
    color: SOFT,
  });
  page.drawText(`By: ${safeText(generatedBy, "System")}`.slice(0, 45), {
    x: PAGE_WIDTH - MARGIN - 170,
    y: PAGE_HEIGHT - 72,
    size: 8,
    font: fonts.regular,
    color: SOFT,
  });
  return PAGE_HEIGHT - 108;
}

function drawSummaryCards(page: any, fonts: PdfFontSet, cards: Array<{ label: string; value: string }>, y: number) {
  const gap = 10;
  const cardWidth = (PAGE_WIDTH - MARGIN * 2 - gap * 3) / 4;
  const cardHeight = 48;

  cards.slice(0, 4).forEach((card, index) => {
    const x = MARGIN + index * (cardWidth + gap);
    page.drawRectangle({ x, y: y - cardHeight, width: cardWidth, height: cardHeight, borderWidth: 1, borderColor: BORDER, color: MUTED_BG });
    page.drawText(card.label.slice(0, 26), { x: x + 9, y: y - 17, size: 7, font: fonts.bold, color: SOFT });
    page.drawText(card.value.slice(0, 28), { x: x + 9, y: y - 37, size: 14, font: fonts.bold, color: TEXT });
  });

  return y - cardHeight - 16;
}

function countErrors(results: ExportableCalculation[]) {
  return results.filter((result) => (result.errors || []).length > 0 || result.fatalError).length;
}

function countWarnings(results: ExportableCalculation[]) {
  return results.filter((result) => (result.warnings || []).length > 0).length;
}

function drawFilters(page: any, fonts: PdfFontSet, filters: ItemPricingExportFilters | null | undefined, y: number) {
  const parts = [
    filters?.q ? `Search: ${filters.q}` : null,
    filters?.ruleSetCode ? `Rule Set: ${filters.ruleSetCode}` : null,
    filters?.itemCodeStartsWith ? `Item starts with: ${filters.itemCodeStartsWith}` : null,
    filters?.includeInactive ? "Includes inactive items" : "Active items only",
    filters?.onlyWithBasePrice === false ? "Includes items without base price" : "Only items with Blank EQP",
    filters?.maxRows ? `Max rows: ${filters.maxRows}` : null,
  ].filter(Boolean);

  const label = parts.length ? parts.join("  •  ") : "No filters applied.";
  page.drawRectangle({ x: MARGIN, y: y - 28, width: PAGE_WIDTH - MARGIN * 2, height: 28, borderWidth: 1, borderColor: BORDER, color: MUTED_BG });
  drawText(page, label, { x: MARGIN + 10, y: y - 18, size: 8, font: fonts.regular, color: SOFT, maxWidth: PAGE_WIDTH - MARGIN * 2 - 20, maxLines: 1 });
  return y - 42;
}

function priceFor(result: ExportableCalculation, method: string, quantityBreakCode: string) {
  const targetMethod = method.toUpperCase();
  const targetBreak = String(quantityBreakCode);
  const match = result.methods.find((m) => methodCode(m) === targetMethod);
  const price = match?.prices.find((p) => String(p.quantityBreakCode) === targetBreak);
  return price?.calculatedPrice ?? null;
}

function drawCompactItemTable(page: any, fonts: PdfFontSet, result: ExportableCalculation, y: number) {
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;
  const headerHeight = 34;
  const rowHeight = 18;
  const methodRows = result.methods
    .slice()
    .sort((a, b) => methodOrder(methodCode(a)) - methodOrder(methodCode(b)));
  const height = headerHeight + Math.max(1, methodRows.length) * rowHeight + 10;
  const hasErrors = (result.errors || []).length > 0 || result.fatalError;
  const hasWarnings = (result.warnings || []).length > 0;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderWidth: 1,
    borderColor: BORDER,
    color: hasErrors ? DANGER_BG : hasWarnings ? WARNING_BG : rgb(1, 1, 1),
  });

  page.drawText(safeText(result.item.itemCode), { x: x + 10, y: y - 17, size: 10, font: fonts.bold, color: TEXT });
  drawText(page, safeText(result.item.itemDescription, ""), {
    x: x + 95,
    y: y - 17,
    size: 8,
    font: fonts.regular,
    color: SOFT,
    maxWidth: 300,
    maxLines: 1,
  });
  page.drawText(`Rule: ${safeText(result.ruleSet.name)}`, { x: x + 410, y: y - 17, size: 8, font: fonts.regular, color: SOFT });
  page.drawText(`Blank EQP: ${money(result.blankEqpPrice)}`, { x: x + 560, y: y - 17, size: 8, font: fonts.bold, color: TEXT });

  const headers = ["Method", "1–23", "15", "24", "48", "96", "144", "576", "2500+"];
  const colXs = [x + 10, x + 145, x + 205, x + 260, x + 315, x + 370, x + 430, x + 490, x + 555];
  headers.forEach((h, i) => page.drawText(h, { x: colXs[i], y: y - 36, size: 7, font: fonts.bold, color: SOFT }));

  let rowY = y - 54;
  if (!methodRows.length) {
    const msg = [...(result.errors || []), result.fatalError].filter(Boolean).join(" | ") || "No pricing methods calculated.";
    drawText(page, msg, { x: x + 10, y: rowY, size: 8, font: fonts.regular, color: SOFT, maxWidth: width - 20, maxLines: 1 });
  } else {
    for (const method of methodRows) {
      const code = methodCode(method);
      page.drawText(itemPricingMethodLabel(code).slice(0, 22), { x: colXs[0], y: rowY, size: 8, font: fonts.bold, color: TEXT });
      const breakCodes = ["1_23", "15", "24", "48", "96", "144", "576", "2500"];
      breakCodes.forEach((breakCode, idx) => {
        page.drawText(money(priceFor(result, code, breakCode)), { x: colXs[idx + 1], y: rowY, size: 8, font: fonts.regular, color: TEXT });
      });
      rowY -= rowHeight;
    }
  }

  return y - height - 10;
}

function drawItemDetail(page: any, fonts: PdfFontSet, result: ExportableCalculation, y: number) {
  page.drawRectangle({ x: MARGIN, y: y - 66, width: PAGE_WIDTH - MARGIN * 2, height: 66, borderWidth: 1, borderColor: BORDER, color: MUTED_BG });
  page.drawText(safeText(result.item.itemCode), { x: MARGIN + 10, y: y - 20, size: 14, font: fonts.bold, color: TEXT });
  drawText(page, safeText(result.item.itemDescription, "No description"), {
    x: MARGIN + 10,
    y: y - 38,
    size: 8,
    font: fonts.regular,
    color: SOFT,
    maxWidth: 340,
    maxLines: 2,
  });
  page.drawText(`Rule Set: ${safeText(result.ruleSet.name)}`, { x: MARGIN + 410, y: y - 20, size: 9, font: fonts.bold, color: TEXT });
  page.drawText(`Blank EQP: ${money(result.blankEqpPrice)}`, { x: MARGIN + 410, y: y - 38, size: 9, font: fonts.bold, color: TEXT });
  page.drawText(`Flat EQP: ${money(result.flatEqpPrice)}    3D EQP: ${money(result.threeDEqpPrice)}`, { x: MARGIN + 410, y: y - 54, size: 8, font: fonts.regular, color: SOFT });

  y -= 86;
  const methods = result.methods.slice().sort((a, b) => methodOrder(methodCode(a)) - methodOrder(methodCode(b)));

  for (const method of methods) {
    const rowCount = method.prices.length + 1;
    const methodHeight = 26 + rowCount * 17;
    if (y - methodHeight < 60) break;

    page.drawText(itemPricingMethodLabel(methodCode(method)), { x: MARGIN, y, size: 12, font: fonts.bold, color: TEXT });
    y -= 18;

    const x = MARGIN;
    const colXs = [x, x + 80, x + 165, x + 255, x + 345, x + 470];
    ["Qty Break", "Price", "Formula", "Base", "Adder", "Trace"].forEach((h, i) => page.drawText(h, { x: colXs[i], y, size: 7, font: fonts.bold, color: SOFT }));
    y -= 14;

    const sortedPrices = method.prices.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    for (const price of sortedPrices) {
      page.drawText(itemPricingQuantityBreakLabel(price.quantityBreakCode), { x: colXs[0], y, size: 8, font: fonts.regular, color: TEXT });
      page.drawText(money(price.calculatedPrice), { x: colXs[1], y, size: 8, font: fonts.bold, color: TEXT });
      page.drawText(safeText(price.trace?.formulaLabel, ""), { x: colXs[2], y, size: 8, font: fonts.regular, color: TEXT });
      page.drawText(money(price.trace?.baseAmount), { x: colXs[3], y, size: 8, font: fonts.regular, color: TEXT });
      page.drawText(money(price.trace?.adderAmount), { x: colXs[4], y, size: 8, font: fonts.regular, color: TEXT });
      drawText(page, `${safeText(price.trace?.baseReference, "")}`.slice(0, 34), { x: colXs[5], y, size: 7, font: fonts.regular, color: SOFT, maxWidth: 190, maxLines: 1 });
      y -= 17;
    }
    y -= 8;
  }

  const messages = [...(result.errors || []), ...(result.warnings || []), result.fatalError].filter(Boolean);
  if (messages.length && y > 90) {
    page.drawText("Warnings / Errors", { x: MARGIN, y, size: 11, font: fonts.bold, color: TEXT });
    y -= 16;
    for (const msg of messages.slice(0, 8)) {
      y = drawText(page, `• ${msg}`, { x: MARGIN + 8, y, size: 8, font: fonts.regular, color: SOFT, maxWidth: PAGE_WIDTH - MARGIN * 2 - 16, maxLines: 2 }) - 2;
    }
  }

  return y;
}

function summarizeByRuleSet(results: ExportableCalculation[]) {
  const map = new Map<string, { ruleSet: string; count: number; errors: number; warnings: number }>();
  for (const result of results) {
    const key = result.ruleSet.code || "UNKNOWN";
    const row = map.get(key) || { ruleSet: result.ruleSet.name || key, count: 0, errors: 0, warnings: 0 };
    row.count += 1;
    if ((result.errors || []).length > 0 || result.fatalError) row.errors += 1;
    if ((result.warnings || []).length > 0) row.warnings += 1;
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => a.ruleSet.localeCompare(b.ruleSet));
}

export async function buildInternalBasePricingPdf(input: PdfBuildInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  let pageNumber = 1;
  let page = addPage(pdfDoc, fonts, pageNumber);
  let y = drawHeader(
    page,
    fonts,
    "Internal Base Pricing PDF",
    `${input.priceBook.code} — ${input.priceBook.name}`,
    input.generatedBy
  );

  y = drawSummaryCards(page, fonts, [
    { label: "Price Book", value: input.priceBook.code },
    { label: "Items", value: String(input.results.length) },
    { label: "Errors", value: String(countErrors(input.results)) },
    { label: "Warnings", value: String(countWarnings(input.results)) },
  ], y);
  y = drawFilters(page, fonts, input.filters, y);

  for (const result of input.results) {
    const approximateHeight = 130;
    if (y - approximateHeight < 52) {
      pageNumber += 1;
      page = addPage(pdfDoc, fonts, pageNumber);
      y = PAGE_HEIGHT - 50;
    }
    y = drawCompactItemTable(page, fonts, result, y);
  }

  return pdfDoc.save();
}

export async function buildItemPricingDetailPdf(input: PdfBuildInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  let pageNumber = 1;
  let page = addPage(pdfDoc, fonts, pageNumber);
  const first = input.results[0];
  let y = drawHeader(
    page,
    fonts,
    "Item Pricing Detail PDF",
    `${input.priceBook.code} — ${first ? safeText(first.item.itemCode) : "No item selected"}`,
    input.generatedBy
  );

  if (!first) {
    drawText(page, "No item was available for this PDF.", { x: MARGIN, y, size: 10, font: fonts.regular, color: SOFT });
  } else {
    drawItemDetail(page, fonts, first, y);
  }

  return pdfDoc.save();
}

export async function buildPriceBookSummaryPdf(input: PdfBuildInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const page = addPage(pdfDoc, fonts, 1);
  let y = drawHeader(
    page,
    fonts,
    "Price Book Summary PDF",
    `${input.priceBook.code} — ${input.priceBook.name}`,
    input.generatedBy
  );

  y = drawSummaryCards(page, fonts, [
    { label: "Items", value: String(input.results.length) },
    { label: "Rule Sets", value: String(summarizeByRuleSet(input.results).length) },
    { label: "Errors", value: String(countErrors(input.results)) },
    { label: "Warnings", value: String(countWarnings(input.results)) },
  ], y);
  y = drawFilters(page, fonts, input.filters, y);

  page.drawText("Rule Set Summary", { x: MARGIN, y, size: 13, font: fonts.bold, color: TEXT });
  y -= 22;

  const rows = summarizeByRuleSet(input.results);
  const colXs = [MARGIN, MARGIN + 300, MARGIN + 390, MARGIN + 480];
  ["Rule Set", "Items", "Errors", "Warnings"].forEach((h, i) => page.drawText(h, { x: colXs[i], y, size: 8, font: fonts.bold, color: SOFT }));
  y -= 16;

  for (const row of rows) {
    if (y < 60) break;
    page.drawText(row.ruleSet.slice(0, 46), { x: colXs[0], y, size: 9, font: fonts.regular, color: TEXT });
    page.drawText(String(row.count), { x: colXs[1], y, size: 9, font: fonts.regular, color: TEXT });
    page.drawText(String(row.errors), { x: colXs[2], y, size: 9, font: fonts.regular, color: TEXT });
    page.drawText(String(row.warnings), { x: colXs[3], y, size: 9, font: fonts.regular, color: TEXT });
    y -= 18;
  }

  if (!rows.length) {
    drawText(page, "No items were included in this summary.", { x: MARGIN, y, size: 10, font: fonts.regular, color: SOFT });
  }

  return pdfDoc.save();
}

export function buildPdfExportFileName(input: { priceBookCode?: string | null; exportType: string; itemCode?: string | null; date?: Date }) {
  const date = input.date || new Date();
  const stamp = date.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const priceBook = String(input.priceBookCode || "PRICE_BOOK").replace(/[^A-Za-z0-9_-]+/g, "_");
  const itemPart = input.itemCode ? `-${String(input.itemCode).replace(/[^A-Za-z0-9_-]+/g, "_")}` : "";
  const kind = String(input.exportType || "PDF").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `item-pricing-${kind}-${priceBook}${itemPart}-${stamp}.pdf`;
}
