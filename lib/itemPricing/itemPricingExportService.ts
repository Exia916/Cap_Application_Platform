// lib/itemPricing/itemPricingExportService.ts

import { itemPricingQuantityBreakLabel } from "@/lib/itemPricing/constants";
import type { ItemPricingCalculationResult } from "@/lib/itemPricing/types";

export const BASE_PRICING_CSV_COLUMNS = [
  "price_book_code",
  "item_code",
  "item_description",
  "rule_set_code",
  "rule_set_name",
  "active",
  "blank_eqp",
  "blank_1_23",
  "blank_24",
  "blank_48",
  "blank_96",
  "blank_144",
  "blank_576",
  "blank_2500",
  "flat_15",
  "flat_24",
  "flat_48",
  "flat_96",
  "flat_144",
  "flat_576",
  "flat_2500",
  "three_d_15",
  "three_d_24",
  "three_d_48",
  "three_d_96",
  "three_d_144",
  "three_d_576",
  "three_d_2500",
  "knit_in_24",
  "knit_in_48",
  "knit_in_96",
  "knit_in_144",
  "knit_in_576",
  "knit_in_2500",
  "warnings",
  "errors",
] as const;

type BasePricingCsvRow = Record<(typeof BASE_PRICING_CSV_COLUMNS)[number], string | number | null>;

type ExportableCalculation = ItemPricingCalculationResult & {
  fatalError?: string | null;
};

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
  return Number(value).toFixed(2);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizedMethodCode(method: unknown): string {
  const raw = method as { methodCode?: unknown; decorationMethodCode?: unknown } | null | undefined;
  return String(raw?.methodCode ?? raw?.decorationMethodCode ?? "")
    .trim()
    .toUpperCase();
}

function methodPrice(result: ExportableCalculation, methodCode: string, quantityBreakCode: string): string {
  const targetMethodCode = String(methodCode).trim().toUpperCase();
  const targetQuantityBreakCode = String(quantityBreakCode).trim();

  const method = result.methods.find((m) => normalizedMethodCode(m) === targetMethodCode);
  const price = method?.prices.find((p) => String(p.quantityBreakCode).trim() === targetQuantityBreakCode);
  return money(price?.calculatedPrice ?? null);
}

function formatMessages(messages: Array<string | null | undefined>): string {
  return messages.filter(Boolean).join(" | ");
}

export function buildBasePricingCsvRows(results: ExportableCalculation[]): BasePricingCsvRow[] {
  return results.map((result) => ({
    price_book_code: result.priceBook.code || "",
    item_code: result.item.itemCode || "",
    item_description: result.item.itemDescription || "",
    rule_set_code: result.ruleSet.code || "",
    rule_set_name: result.ruleSet.name || "",
    active: result.item.active === false ? "N" : "Y",
    blank_eqp: money(result.blankEqpPrice ?? null),
    blank_1_23: methodPrice(result, "BLANK", "1_23"),
    blank_24: methodPrice(result, "BLANK", "24"),
    blank_48: methodPrice(result, "BLANK", "48"),
    blank_96: methodPrice(result, "BLANK", "96"),
    blank_144: methodPrice(result, "BLANK", "144"),
    blank_576: methodPrice(result, "BLANK", "576"),
    blank_2500: methodPrice(result, "BLANK", "2500"),
    flat_15: methodPrice(result, "FLAT_EMB", "15"),
    flat_24: methodPrice(result, "FLAT_EMB", "24"),
    flat_48: methodPrice(result, "FLAT_EMB", "48"),
    flat_96: methodPrice(result, "FLAT_EMB", "96"),
    flat_144: methodPrice(result, "FLAT_EMB", "144"),
    flat_576: methodPrice(result, "FLAT_EMB", "576"),
    flat_2500: methodPrice(result, "FLAT_EMB", "2500"),
    three_d_15: methodPrice(result, "THREE_D_EMB", "15"),
    three_d_24: methodPrice(result, "THREE_D_EMB", "24"),
    three_d_48: methodPrice(result, "THREE_D_EMB", "48"),
    three_d_96: methodPrice(result, "THREE_D_EMB", "96"),
    three_d_144: methodPrice(result, "THREE_D_EMB", "144"),
    three_d_576: methodPrice(result, "THREE_D_EMB", "576"),
    three_d_2500: methodPrice(result, "THREE_D_EMB", "2500"),
    knit_in_24: methodPrice(result, "KNIT_IN", "24"),
    knit_in_48: methodPrice(result, "KNIT_IN", "48"),
    knit_in_96: methodPrice(result, "KNIT_IN", "96"),
    knit_in_144: methodPrice(result, "KNIT_IN", "144"),
    knit_in_576: methodPrice(result, "KNIT_IN", "576"),
    knit_in_2500: methodPrice(result, "KNIT_IN", "2500"),
    warnings: formatMessages(result.warnings || []),
    errors: formatMessages([...(result.errors || []), result.fatalError]),
  }));
}

export function buildBasePricingCsv(results: ExportableCalculation[]): string {
  const rows = buildBasePricingCsvRows(results);
  const header = BASE_PRICING_CSV_COLUMNS.join(",");
  const body = rows.map((row) => BASE_PRICING_CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  return [header, ...body].join("\n") + "\n";
}

export function buildExportFileName(input: { priceBookCode?: string | null; date?: Date }) {
  const date = input.date || new Date();
  const stamp = date.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const priceBook = String(input.priceBookCode || "PRICE_BOOK").replace(/[^A-Za-z0-9_-]+/g, "_");
  return `item-pricing-base-${priceBook}-${stamp}.csv`;
}

export function describeBasePricingCsvColumns(): Array<{ column: string; description: string }> {
  return BASE_PRICING_CSV_COLUMNS.map((column) => {
    const match = column.match(/^(blank|flat|three_d|knit_in)_(.+)$/);
    if (!match) return { column, description: column.replace(/_/g, " ") };
    return {
      column,
      description: `${match[1].replace(/_/g, " ")} pricing for ${itemPricingQuantityBreakLabel(match[2])}`,
    };
  });
}
