// lib/reports/reportPdfExport.ts

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuthUserWithLegacy } from "@/lib/auth";
import { getReportDataset } from "./reportRegistry";
import { getReportTemplate } from "./reportTemplates";
import { runReport } from "./reportRepo";
import type { ReportOutputColumn, ReportRunRequest, ReportRunResult } from "./reportTypes";
import {
  formatReportCell,
  formatReportDateTime,
  formatReportFilterValue,
  formatReportNumber,
  humanizeReportLabel,
} from "./reportFormatters";

type ExportReportPdfInput = {
  reportName?: string | null;
  reportDescription?: string | null;
  chartImageDataUrl?: string | null;
  tablePreviewLimit?: number | null;
  request: ReportRunRequest;
};

type PdfFontSet = {
  regular: any;
  bold: any;
};

type NativeChartPoint = {
  label: string;
  value: number;
};

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 36;
const TEXT = rgb(0.07, 0.1, 0.15);
const SOFT = rgb(0.38, 0.42, 0.48);
const BORDER = rgb(0.84, 0.86, 0.9);
const MUTED_BG = rgb(0.96, 0.97, 0.98);
const GRID = rgb(0.86, 0.88, 0.91);
const BAR = rgb(0.05, 0.07, 0.1);

function userName(user: AuthUserWithLegacy) {
  return user.displayName || user.name || user.username || "Unknown";
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
  return lines;
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
  const lines = opts.maxWidth
    ? wrapText(text, opts.font, opts.size, opts.maxWidth)
    : String(text || "").split("\n");

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

function addPage(pdfDoc: PDFDocument, fonts: PdfFontSet, pageNumber: number) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  page.drawText("CAP Reporting", {
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

function isPercentLikeColumn(column: ReportOutputColumn) {
  const key = String(column.key || "").toLowerCase();
  const label = String(column.label || "").toLowerCase();

  return (
    column.format === "percent" ||
    key.includes("rate") ||
    label.includes("rate") ||
    label.includes("%")
  );
}

function isPerThousandColumn(column: ReportOutputColumn) {
  const key = String(column.key || "").toLowerCase();
  const label = String(column.label || "").toLowerCase();

  return key.includes("per_1000") || label.includes("per 1,000");
}

function numericValuesForColumn(result: ReportRunResult, columnKey: string) {
  return result.rows
    .map((row) => Number(row[columnKey] ?? 0))
    .filter((value) => Number.isFinite(value));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function summarizeColumn(result: ReportRunResult, column: ReportOutputColumn) {
  const values = numericValuesForColumn(result, column.key);

  if (isPercentLikeColumn(column)) {
    return {
      label: `Avg ${humanizeReportLabel(column.label)}`.slice(0, 28),
      value: `${formatReportNumber(average(values), 2)}%`,
    };
  }

  if (isPerThousandColumn(column)) {
    return {
      label: `Avg ${humanizeReportLabel(column.label)}`.slice(0, 28),
      value: formatReportNumber(average(values), 2),
    };
  }

  return {
    label: humanizeReportLabel(column.label).slice(0, 28),
    value: formatReportNumber(sum(values)),
  };
}

function summarizeRows(result: ReportRunResult) {
  const numericColumns = result.columns
    .filter((column) => column.type === "number")
    .slice(0, 3);

  const cards = [
    { label: "Rows", value: formatReportNumber(result.total, 0) },
    ...numericColumns.map((column) => summarizeColumn(result, column)),
  ];

  return cards.slice(0, 4);
}

function describeFilters(request: ReportRunRequest) {
  const dataset = getReportDataset(request.datasetKey);
  const columnMap = new Map((dataset?.columns ?? []).map((column) => [column.key, column]));
  const rows: string[] = [];

  for (const [key, filter] of Object.entries(request.filters ?? {})) {
    const column = columnMap.get(key);
    rows.push(`${column?.label ?? key}: ${formatReportFilterValue(filter)}`);
  }

  if (!rows.length) return ["No filters applied."];

  const logic = request.filterLogic === "OR" ? "Match Any" : "Match All";
  return [`${logic} Filters`, ...rows];
}

function drawSummaryCards(
  page: any,
  fonts: PdfFontSet,
  result: ReportRunResult,
  x: number,
  y: number
) {
  const cards = summarizeRows(result);
  const gap = 10;
  const cardWidth = (PAGE_WIDTH - MARGIN * 2 - gap * 3) / 4;
  const cardHeight = 54;

  cards.forEach((card, index) => {
    const cx = x + index * (cardWidth + gap);

    page.drawRectangle({
      x: cx,
      y: y - cardHeight,
      width: cardWidth,
      height: cardHeight,
      borderWidth: 1,
      borderColor: BORDER,
      color: MUTED_BG,
    });

    page.drawText(card.label.slice(0, 28), {
      x: cx + 10,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: SOFT,
    });

    page.drawText(String(card.value), {
      x: cx + 10,
      y: y - 40,
      size: 16,
      font: fonts.bold,
      color: TEXT,
    });
  });

  return y - cardHeight - 18;
}

function getDistinctCount(rows: Record<string, unknown>[], columnKey: string) {
  const values = new Set<string>();

  for (const row of rows) {
    const value = row[columnKey];
    if (value !== null && value !== undefined && String(value).trim()) {
      values.add(String(value));
    }
  }

  return values.size;
}

function pickChartLabelColumn(result: ReportRunResult) {
  const candidates = result.columns.filter(
    (column) => column.type !== "number" && column.key !== "record_url"
  );

  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const distinctDiff =
      getDistinctCount(result.rows, b.key) - getDistinctCount(result.rows, a.key);
    if (distinctDiff !== 0) return distinctDiff;

    const aTextScore = a.type === "text" ? 1 : 0;
    const bTextScore = b.type === "text" ? 1 : 0;
    return bTextScore - aTextScore;
  })[0];
}

function pickChartValueColumn(result: ReportRunResult) {
  const preferred = result.columns.find((column) => {
    const key = String(column.key || "").toLowerCase();
    return (
      column.type === "number" &&
      (key.includes("accountable_recut_piece_rate") ||
        key.includes("gross_recut_piece_rate") ||
        key.includes("reject_rate"))
    );
  });

  return preferred ?? result.columns.find((column) => column.type === "number") ?? null;
}

function buildNativeChartPoints(result: ReportRunResult, maxPoints = 24) {
  const labelColumn = pickChartLabelColumn(result);
  const valueColumn = pickChartValueColumn(result);

  if (!valueColumn || !result.rows.length) {
    return {
      labelColumn,
      valueColumn,
      points: [] as NativeChartPoint[],
    };
  }

  const points = result.rows
    .map((row, index) => {
      const rawLabel = labelColumn ? row[labelColumn.key] : `Row ${index + 1}`;
      const value = Number(row[valueColumn.key] ?? 0);

      return {
        label: String(
          formatReportCell(rawLabel, labelColumn?.type ?? "text") || `Row ${index + 1}`
        ),
        value: Number.isFinite(value) ? value : 0,
      };
    })
    .filter((point) => Number.isFinite(point.value));

  return {
    labelColumn,
    valueColumn,
    points: points.slice(0, maxPoints),
  };
}

function drawNativeChart(
  page: any,
  fonts: PdfFontSet,
  result: ReportRunResult,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const { labelColumn, valueColumn, points } = buildNativeChartPoints(result);

  page.drawText("Chart", {
    x,
    y,
    size: 13,
    font: fonts.bold,
    color: TEXT,
  });

  y -= 16;

  if (!valueColumn || !points.length) {
    page.drawRectangle({
      x,
      y: y - 42,
      width,
      height: 42,
      borderWidth: 1,
      borderColor: BORDER,
      color: MUTED_BG,
    });

    page.drawText("No chartable numeric data was returned for this report.", {
      x: x + 10,
      y: y - 25,
      size: 9,
      font: fonts.regular,
      color: SOFT,
    });

    return y - 62;
  }

  const chartTitle = `${humanizeReportLabel(valueColumn.label)} by ${
    labelColumn ? humanizeReportLabel(labelColumn.label) : "Row"
  }`;

  page.drawText(chartTitle.slice(0, 110), {
    x,
    y,
    size: 8,
    font: fonts.regular,
    color: SOFT,
  });

  y -= 10;

  const chartX = x + 44;
  const chartY = y - height + 28;
  const chartWidth = width - 54;
  const chartHeight = height - 46;

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderWidth: 1,
    borderColor: BORDER,
    color: rgb(1, 1, 1),
  });

  const values = points.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const zeroY = chartY + ((0 - minValue) / range) * chartHeight;

  for (let i = 0; i <= 4; i += 1) {
    const tickValue = minValue + (range * i) / 4;
    const tickY = chartY + ((tickValue - minValue) / range) * chartHeight;

    page.drawLine({
      start: { x: chartX, y: tickY },
      end: { x: chartX + chartWidth, y: tickY },
      thickness: 0.5,
      color: GRID,
    });

    page.drawText(formatReportNumber(tickValue, 0), {
      x: x + 4,
      y: tickY - 3,
      size: 6,
      font: fonts.regular,
      color: SOFT,
    });
  }

  page.drawLine({
    start: { x: chartX, y: chartY },
    end: { x: chartX, y: chartY + chartHeight },
    thickness: 0.8,
    color: SOFT,
  });

  page.drawLine({
    start: { x: chartX, y: zeroY },
    end: { x: chartX + chartWidth, y: zeroY },
    thickness: 0.8,
    color: SOFT,
  });

  const gap = 3;
  const barWidth = Math.max(4, (chartWidth - gap * (points.length - 1)) / points.length);

  points.forEach((point, index) => {
    const barX = chartX + index * (barWidth + gap);
    const valueY = chartY + ((point.value - minValue) / range) * chartHeight;
    const barY = Math.min(zeroY, valueY);
    const barHeight = Math.max(1, Math.abs(valueY - zeroY));

    page.drawRectangle({
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      color: BAR,
    });

    const label = point.label.length > 12 ? `${point.label.slice(0, 11)}…` : point.label;
    if (index % Math.ceil(points.length / 12) === 0) {
      page.drawText(label, {
        x: barX,
        y: chartY - 12,
        size: 5,
        font: fonts.regular,
        color: SOFT,
      });
    }
  });

  page.drawText(humanizeReportLabel(valueColumn.label), {
    x: chartX + chartWidth - 90,
    y: y - height + 8,
    size: 7,
    font: fonts.bold,
    color: TEXT,
  });

  if (result.rows.length > points.length) {
    page.drawText(`Showing first ${points.length} chart points.`, {
      x: x + width - 130,
      y: y - height + 8,
      size: 7,
      font: fonts.regular,
      color: SOFT,
    });
  }

  return y - height - 18;
}

function drawChartSection(
  pdfDoc: PDFDocument,
  page: any,
  fonts: PdfFontSet,
  result: ReportRunResult,
  y: number,
  pageNumber: number
) {
  const chartHeight = 185;

  if (y - chartHeight < MARGIN + 60) {
    pageNumber += 1;
    page = addPage(pdfDoc, fonts, pageNumber);
    y = PAGE_HEIGHT - MARGIN;
  }

  const nextY = drawNativeChart(
    page,
    fonts,
    result,
    MARGIN,
    y,
    PAGE_WIDTH - MARGIN * 2,
    chartHeight
  );

  return {
    page,
    pageNumber,
    y: nextY,
  };
}

function drawTablePreview(
  pdfDoc: PDFDocument,
  startPage: any,
  fonts: PdfFontSet,
  result: ReportRunResult,
  startY: number,
  pageNumberStart: number,
  previewLimit: number
) {
  let page = startPage;
  let pageNumber = pageNumberStart;
  let y = startY;

  const columns = result.columns.slice(0, 7);
  const colWidth = (PAGE_WIDTH - MARGIN * 2) / Math.max(columns.length, 1);

  function ensureSpace(required: number) {
    if (y - required > MARGIN + 20) return;
    pageNumber += 1;
    page = addPage(pdfDoc, fonts, pageNumber);
    y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(40);
  page.drawText("Table Preview", {
    x: MARGIN,
    y,
    size: 13,
    font: fonts.bold,
    color: TEXT,
  });
  y -= 18;

  page.drawText(`Showing first ${previewLimit} rows. Use Export CSV for full detailed data.`, {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.regular,
    color: SOFT,
  });
  y -= 18;

  ensureSpace(30);
  page.drawRectangle({
    x: MARGIN,
    y: y - 18,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 22,
    color: MUTED_BG,
    borderWidth: 1,
    borderColor: BORDER,
  });

  columns.forEach((column, index) => {
    drawText(page, humanizeReportLabel(column.label).slice(0, 20), {
      x: MARGIN + index * colWidth + 4,
      y: y - 12,
      font: fonts.bold,
      size: 7,
      color: TEXT,
      maxWidth: colWidth - 8,
      maxLines: 1,
    });
  });

  y -= 26;

  for (const row of result.rows.slice(0, previewLimit)) {
    ensureSpace(18);

    columns.forEach((column, index) => {
      const value =
        column.key === "record_url"
          ? "Open Record"
          : formatReportCell(row[column.key], column.type);

      drawText(page, String(value).slice(0, 32), {
        x: MARGIN + index * colWidth + 4,
        y,
        font: fonts.regular,
        size: 7,
        color: TEXT,
        maxWidth: colWidth - 8,
        maxLines: 1,
      });
    });

    y -= 16;
  }

  return pageNumber;
}

export async function buildReportPdfExport(
  input: ExportReportPdfInput,
  user: AuthUserWithLegacy
) {
  const previewLimit = Math.min(
    Math.max(Number(input.tablePreviewLimit || input.request.pageSize || 100), 1),
    250
  );

  const request: ReportRunRequest = {
    ...input.request,
    page: 1,
    pageSize: previewLimit,
  };

  const result = await runReport(request, user);
  const dataset = getReportDataset(request.datasetKey);
  const templateKey = (input.request as any)?.chartConfig?.templateKey;
  const template = getReportTemplate(typeof templateKey === "string" ? templateKey : null);

  const pdfDoc = await PDFDocument.create();
  const fonts: PdfFontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  let pageNumber = 1;
  let page = addPage(pdfDoc, fonts, pageNumber);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText("CAP Report", {
    x: MARGIN,
    y,
    size: 18,
    font: fonts.bold,
    color: TEXT,
  });
  y -= 24;

  y = drawText(page, input.reportName || template?.label || dataset?.label || "Report", {
    x: MARGIN,
    y,
    size: 15,
    font: fonts.bold,
    color: TEXT,
    maxWidth: PAGE_WIDTH - MARGIN * 2,
    maxLines: 2,
  });

  if (input.reportDescription) {
    y -= 4;
    y = drawText(page, input.reportDescription, {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.regular,
      color: SOFT,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
      maxLines: 3,
    });
  }

  y -= 10;
  page.drawText(`Dataset: ${dataset?.label ?? request.datasetKey}`, {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.regular,
    color: SOFT,
  });
  y -= 12;

  page.drawText(`Run: ${formatReportDateTime(new Date().toISOString())}    Run By: ${userName(user)}`, {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.regular,
    color: SOFT,
  });
  y -= 20;

  const filterLines = describeFilters(request);
  page.drawText("Active Filters", {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.bold,
    color: TEXT,
  });
  y -= 14;

  for (const line of filterLines.slice(0, 8)) {
    y = drawText(page, line, {
      x: MARGIN,
      y,
      size: 8,
      font: fonts.regular,
      color: SOFT,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
      maxLines: 1,
    });
  }

  y -= 12;
  y = drawSummaryCards(page, fonts, result, MARGIN, y);

  const chartSection = drawChartSection(pdfDoc, page, fonts, result, y, pageNumber);
  page = chartSection.page;
  pageNumber = chartSection.pageNumber;
  y = chartSection.y;

  pageNumber = drawTablePreview(pdfDoc, page, fonts, result, y, pageNumber, previewLimit);

  return pdfDoc.save();
}